import path from 'path';
import { readFile } from 'fs/promises';
import type { LintMdRulesConfig, lintMarkdown } from '@lint-md/core';
import { Piscina } from 'piscina';
import type { LintWorkerOptions } from '../types';
import { averagedGroup } from './averaged-group';

async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

export const batchLint = async (
  threadsCount: number,
  mdFilePaths: string[],
  isDev: boolean,
  isFixMode: boolean,
  rules: LintMdRulesConfig
) => {
  const runner = new Piscina({
    filename: path.resolve(__dirname, './lint-worker'),
    maxThreads: Math.max(threadsCount, 1),
  });

  const fileContentList = await limitConcurrency(
    mdFilePaths.map((filePath) => {
      return async () => {
        const res = await readFile(filePath);
        return {
          path: filePath,
          content: res.toString(),
        };
      };
    }),
    threadsCount
  );

  // 将 md 文件内容进行分组，供各个线程分配执行
  const markdownContentGroup = averagedGroup(fileContentList, Math.max(threadsCount, 1), (item) => {
    return item.content.length;
  });

  const res = await Promise.all(
    markdownContentGroup.map((groupItem) => {
      const asyncCall = async () => {
        const batchLintResult: ReturnType<typeof lintMarkdown>[]
          = await runner.run({
            contentList: groupItem.items.map((value) => {
              return value.content;
            }),
            isFixMode,
            rules,
            isDev,
          } as LintWorkerOptions);

        return batchLintResult.map((lintResult, index) => {
          return {
            ...lintResult,
            path: groupItem.items[index].path,
          };
        });
      };

      return asyncCall();
    })
  );

  return res.flat().filter((item) => {
    return item.lintResult.length > 0;
  });
};

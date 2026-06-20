import path from 'path';
import { readFile } from 'fs/promises';
import type { LintMdRulesConfig, lintMarkdown } from '@lint-md/core';
import { Piscina } from 'piscina';
import type { LintWorkerOptions } from '../types';

export async function runTasksWithLimit<T>(
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
  rules: LintMdRulesConfig,
) => {
  const concurrency = Math.max(threadsCount, 1);

  const lintWorkerPool = new Piscina({
    filename: path.resolve(__dirname, './lint-worker'),
    maxThreads: concurrency,
  });

  const problemResults: {
    path: string
    lintResult: ReturnType<typeof lintMarkdown>['lintResult']
    fixedResult?: ReturnType<typeof lintMarkdown>['fixedResult']
  }[] = [];

  for (let start = 0; start < mdFilePaths.length; start += concurrency) {
    const currentBatchPaths = mdFilePaths.slice(start, start + concurrency);
    const fileContentList = await runTasksWithLimit(
      currentBatchPaths.map((filePath) => {
        return async () => {
          const content = await readFile(filePath, 'utf8');
          return {
            path: filePath,
            content,
          };
        };
      }),
      concurrency
    );

    const batchLintResult = await lintWorkerPool.run({
      contentList: fileContentList.map(item => item.content),
      isFixMode,
      rules,
      isDev,
    } as LintWorkerOptions) as ReturnType<typeof lintMarkdown>[];

    const batchResults = batchLintResult.map((lintResult, index) => {
      return {
        ...lintResult,
        path: fileContentList[index].path,
      };
    });

    problemResults.push(...batchResults.filter((item) => {
      return item.lintResult.length > 0;
    }));
  }

  return problemResults;
};

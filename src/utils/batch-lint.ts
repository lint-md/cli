import path from 'path';
import type { LintMdRulesConfig, lintMarkdown } from '@lint-md/core';
import * as fs from 'fs-extra';
// @ts-expect-error
import { Piscina } from 'piscina';
import type { LintWorkerOptions } from '../types';
import { averagedGroup } from './averaged-group';

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

  const fileContentList = await Promise.all(
    mdFilePaths.map((path) => {
      const call = async () => {
        const res = await fs.readFile(path);
        return {
          path,
          content: res.toString(),
        };
      };
      return call();
    })
  );

  // 将 md 文件内容进行分组，供各个线程分配执行
  const markdownContentGroup = averagedGroup(fileContentList, 10, (item) => {
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

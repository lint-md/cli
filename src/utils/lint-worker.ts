import { lintMarkdown } from '@lint-md/core';
import type { LintWorkerOptions } from '../types';

const lintWorker = (options: LintWorkerOptions) => {
  const { contentList, rules, isFixMode, isDev } = options;
  const start = new Date().getTime();

  const res = contentList.map((content) => {
    return lintMarkdown(content, rules, isFixMode);
  });

  const end = new Date().getTime();

  if (isDev) {
    console.log(
      'Group 耗时：',
      end - start,
      ' Group 长度：',
      contentList.length,
      ' 字符串长度：',
      contentList.reduce((acc, curr) => {
        return acc + curr.length;
      }, 0)
    );
  }

  return res;
};

export default lintWorker;

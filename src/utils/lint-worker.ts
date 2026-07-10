import { readFile } from 'fs/promises';
import { lintMarkdown } from '@lint-md/core';
import type { LintWorkerOptions } from '../types';

const lintWorker = async (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode, isDev } = options;
  const start = new Date().getTime();

  const content = await readFile(filePath, 'utf8');
  const result = lintMarkdown(content, rules, isFixMode);

  const end = new Date().getTime();

  if (isDev) {
    console.log(
      'File 耗时：',
      end - start,
      ' 文件：',
      filePath,
      ' 字符串长度：',
      content.length
    );
  }

  return {
    path: filePath,
    lintResult: result.lintResult,
    fixedResult: result.fixedResult,
    fixableErrorCount: result.fixableErrorCount,
    fixableWarningCount: result.fixableWarningCount,
  };
};

export default lintWorker;

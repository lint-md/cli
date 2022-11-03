import * as path from 'path';
import * as fs from 'fs';
import { lint as runLint } from '@lint-md/core';
import type { CLIConfig, CLILintResult } from '../types';

/**
 * 使用 ast 和插件进行 lint
 *
 * @param filePath 文件路径
 * @param config lint 配置
 * @return {Promise<CLILintResult>} lint 结果
 */
export const lint = (
  filePath: string,
  config?: CLIConfig
): Promise<CLILintResult> => {
  const rules = config ? config.rules : {};

  return new Promise((resolve) => {
    const file = path.resolve(filePath);
    const markdown = fs.readFileSync(file, { encoding: 'utf8' });

    const errors = runLint(markdown, rules);

    resolve({
      path: path.dirname(file),
      file: path.basename(file),
      // 去重
      errors,
    });
  });
};

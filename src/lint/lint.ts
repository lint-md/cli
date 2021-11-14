import * as path from 'path';
import * as fs from 'fs';
import { lint as runLint } from '@lint-md/core';
import { CliLintResult, CliConfig } from '../types';

/**
 * 使用 ast 和插件进行 lint
 *
 * @param filePath 文件路径
 * @param config lint 配置
 * @return {Promise<CliLintResult>} lint 结果
 */
export const lint = (filePath: string, config?: CliConfig): Promise<CliLintResult> => {
  const rules = config ? config.rules : {};

  return new Promise((resolve) => {
    const file = path.resolve(filePath);
    const markdown = fs.readFileSync(file, { encoding: 'utf8' });

    const errors = runLint(markdown, rules);

    resolve({
      path: path.dirname(file),
      file: path.basename(file),
      // 去重
      errors
    });
  });
};

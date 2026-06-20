import * as fs from 'fs';
import { cpus } from 'os';
import * as path from 'path';
import chalk from 'chalk';
import type { CLIConfig } from '../types';

export const getLintConfig = (configFilePath?: string): Required<CLIConfig> => {
  if (configFilePath && !fs.existsSync(configFilePath)) {
    console.log(
      chalk.red(`lint-md: Configure file '${configFilePath}' is not exist.`)
    );
    process.exit(1);
  }

  let config: CLIConfig;

  const configPath = path.resolve(configFilePath || './.lintmdrc');

  // 如果不存在文件直接返回空对象
  if (!fs.existsSync(configPath)) {
    config = {};
  }
  else {
    try {
      config = JSON.parse(fs.readFileSync(configPath).toString());
    }
    catch (e) {
      console.log(
        chalk.red(`[lint-md] Configure file '${configPath}' is invalid.`)
      );
      console.log(e);
      process.exit(1);
    }
  }

  return {
    excludeFiles: ['**/node_modules/**', '**/.git/**'],
    rules: {},
    extensions: ['.md', '.markdown', '.mdx'],
    ...config,
  };
};

export const getThreadCount = (threadCount?: string | number | boolean): number => {
  // 只接受 number 或 string，其他（undefined / boolean）视为未指定
  if (typeof threadCount !== 'number' && typeof threadCount !== 'string') {
    return cpus().length;
  }

  // 字符串必须是十进制正整数（拒绝 0x10、1e3、010 等）
  if (typeof threadCount === 'string' && !/^[1-9]\d*$/.test(threadCount)) {
    console.error(chalk.red('[lint-md] --threads must be a positive integer.'));
    process.exit(1);
  }

  const num = Number(threadCount);

  if (!Number.isInteger(num) || num <= 0) {
    console.error(chalk.red('[lint-md] --threads must be a positive integer.'));
    process.exit(1);
  }

  return num;
};

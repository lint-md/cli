import * as fs from 'fs';
import { cpus } from 'os';
import * as path from 'path';
import chalk from 'chalk';
import { merge } from 'lodash';
import type { CLIConfig } from '../types';

export const getLintConfig = (configFilePath: string): CLIConfig => {
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
    config = {} as any;
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

  return merge(
    {
      excludeFiles: ['**/node_modules/**', '**/.git/**'],
      rules: {},
    },
    config
  );
};

export const getThreadCount = (threadCount: string | number | boolean) => {
  if (typeof threadCount === 'number') {
    return threadCount;
  }
  if (typeof threadCount === 'string') {
    return Number(threadCount);
  }

  return threadCount ? cpus().length : 1;
};

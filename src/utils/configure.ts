import * as fs from 'fs';
import * as chalk from 'chalk';
import { merge } from 'lodash';
import type { CLIConfig } from '../types';
import { log } from './common';

export const getLintConfig = (configFilePath: string): CLIConfig => {
  if (configFilePath && !fs.existsSync(configFilePath)) {
    log(chalk.red(`lint-md: Configure file '${configFilePath}' is not exist.`));
    process.exit(1);
  }

  let config: CLIConfig;
  try {
    config = JSON.parse(
      fs.readFileSync(configFilePath || './.lintmdrc').toString()
    );
  }
  catch (e) {
    // 不存在配置文件、配置文件不是 json，配置为空！
    config = {} as any;
  }

  return merge(
    {
      excludeFiles: ['**/node_modules/**', '**/.git/**'],
      rules: {}
    },
    config
  );
};


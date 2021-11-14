import * as fs from 'fs';
import * as _ from 'lodash';
import * as chalk from 'chalk';
import { CliConfig } from '../types';
import { log } from './common';

const getConfig = (file: string): CliConfig => {
  let config: CliConfig;
  try {
    config = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
  } catch (e) {
    // 不存在配置文件、配置文件不是 json，配置为空！
    config = {} as any;
  }

  return _.merge(
    {
      excludeFiles: ['**/node_modules/**', '**/.git/**'],
      rules: {},
    },
    config
  );
};

export const configure = (configFile: string) => {
  if (configFile && !fs.existsSync(configFile)) {
    log(chalk.red(`lint-md: Configure file '${configFile}' is not exist.`));
    process.exit(1);
  }
  return getConfig(configFile || './.lintmdrc');
};

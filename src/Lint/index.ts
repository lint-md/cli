import * as _ from 'lodash';
import chalk from 'chalk';

import { loadMdFiles } from '../helper/load-md-files';
import { getDescription } from 'lint-md';
import { lint } from './lint';
import { rightPad } from '../helper/string';
import { log } from '../helper/common';
import { CliConfig } from '../types';

export class Lint {
  private readonly files: string[];
  private readonly config: CliConfig;
  private readonly errorFiles: string[];

  constructor(files: string[], config: CliConfig) {
    this.files = files;
    this.config = config;

    // 开始处理
    this.start();
  }

  async start() {
    const mdFiles = await loadMdFiles(this.files, this.config);

    // 错误，格式为：{ path, file, errors: { start: { line, column }, end: { line, column } level, text, type } }
    const errorFiles = [];

    for (const file of mdFiles) {
      const errorFile = await lint(file, this.config);

      errorFiles.push(errorFile);

      this.printErrorFile(errorFile);
    }

    this.printOverview(errorFiles);

    const { error, warning } = this.errorCount(errorFiles);
    // 是否出错
    process.exit(error === 0 ? 0 : 1);
  }

  /**
   * 打印一个文件的错误信息
   * @param errorFile
   * @return {Promise<any>}
   */
  printErrorFile(errorFile) {
    const { path, file, errors } = errorFile;

    if (errors.length) log(`${path}/${file}`);

    _.forEach(errors, this.printError);

    if (errors.length) log();
  }

  /**
   * 打印一个错误
   * @param error
   */
  printError(error) {
    const { start, end, level, text, type } = error;
    const pos = `${start.line}:${start.column}-${end.line}:${end.column}`;


    log(chalk.grey(
      '  ',
      rightPad(pos, 16),
      '    ',
      rightPad(`${type}`, 24),
      '    ',
      chalk[level === 'error' ? 'red' : 'yellow'](`${getDescription(type).message} ${text}`)
    ));
  }

  /**
   * 打印概览
   */
  printOverview(errorFiles) {
    const fileCount = errorFiles.length;
    const { error, warning } = this.errorCount(errorFiles);

    log(
      chalk.green(`Lint total ${fileCount} files,`),
      chalk.yellow(`${warning} warnings`),
      chalk.red(`${error} errors`)
    );
  }

  /**
   * 计数
   * @return {{error: *, warning: *}}
   */
  errorCount(errorFiles) {
    const warningCnt = errorFiles.reduce((r, current) => {
      return r + current.errors.filter(error => error.level === 'warning').length;
    }, 0);

    const errorCnt = errorFiles.reduce((r, current) => {
      return r + current.errors.filter(error => error.level === 'error').length;
    }, 0);

    return {
      error: errorCnt,
      warning: warningCnt
    };
  };
};

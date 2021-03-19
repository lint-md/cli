import * as _ from 'lodash';
import * as chalk from 'chalk';

import { loadMdFiles } from '../helper/load-md-files';
import { getDescription, LintMdError } from 'lint-md';
import { lint } from './lint';
import { rightPad } from '../helper/string';
import { log } from '../helper/common';
import { CliConfig, CliErrorCount, CliLintResult } from '../types';

export class Lint {
  private readonly files: string[];
  private readonly config: CliConfig;
  private readonly errorFiles: CliLintResult[];

  constructor(files: string[], config: CliConfig) {
    this.files = files;
    this.config = config;

    // 开始处理
    this.start();
  }

  async start() {
    const mdFiles = await loadMdFiles(this.files, this.config);


    for (const file of mdFiles) {
      const errorFile = await lint(file, this.config);

      this.errorFiles.push(errorFile);

      this.printErrorFile(errorFile);
    }

    this.printOverview();

    const { error } = this.errorCount();
    // 是否出错
    process.exit(error === 0 ? 0 : 1);
  }

  /**
   * 打印一个文件的错误信息
   * @param errorFile
   * @return {Promise<any>}
   */
  printErrorFile(errorFile: CliLintResult) {
    const { path, file, errors } = errorFile;

    if (errors.length) log(`${path}/${file}`);

    _.forEach(errors, this.printError);

    if (errors.length) log();
  }

  /**
   * 打印一个错误
   *
   * @param error {LintMdError} lint-md API 的错误描述信息
   */
  printError(error: LintMdError) {
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
  printOverview() {
    const fileCount = this.errorFiles.length;
    const { error, warning } = this.errorCount();

    log(
      chalk.green(`Lint total ${fileCount} files,`),
      chalk.yellow(`${warning} warnings`),
      chalk.red(`${error} errors`)
    );
  }

  /**
   * 获取错误结果
   *
   * @return {CliErrorCount} 一个对象，存放了 error 和 warning 各自数目
   */
  errorCount(): CliErrorCount {
    const warningCnt = this.errorFiles.reduce((r, current) => {
      return r + current.errors.filter(error => error.level === 'warning').length;
    }, 0);

    const errorCnt = this.errorFiles.reduce((r, current) => {
      return r + current.errors.filter(error => error.level === 'error').length;
    }, 0);

    return {
      error: errorCnt,
      warning: warningCnt
    };
  };
}

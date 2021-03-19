import chalk from 'chalk';
import { loadMdFiles } from '../helper/load-md-files';
import { fix } from './fix';
import { CliConfig } from '../types';
import { log } from '../helper/common';

export class Fix {
  private readonly files: string[];
  private readonly config: CliConfig;

  constructor(files: string[], config: CliConfig) {
    this.files = files;
    this.config = config;
    this.start();
  }

  async start() {
    const mdFiles = await loadMdFiles(this.files, this.config);

    for (const file of mdFiles) {
      const isRewrite = await fix(file, this.config);

      // 重新过的，才加进去
      if (isRewrite) {
        this.printFile(file);
      }
    }

    // 退出
    process.exit(0);
  }

  printFile(file) {
    log(chalk.green(file));
  }
}

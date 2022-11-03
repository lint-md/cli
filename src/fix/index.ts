import * as chalk from 'chalk';
import { loadMdFiles } from '../helper/load-md-files';
import type { CLIConfig } from '../types';
import { log } from '../helper/common';
import { fix } from './fix';

export class Fix {
  private readonly files: string[];
  private readonly config: CLIConfig;

  constructor(files: string[], config?: CLIConfig) {
    this.files = files;
    this.config = config;
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
  }

  printFile(file) {
    log(chalk.green(file));
  }
}

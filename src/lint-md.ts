#!/usr/bin/env node

import * as process from 'process';
import * as program from 'commander';
import { Lint } from './lint';
import { Fix } from './fix';
import { configure } from './helper/configure';
import type { CliOptions } from './types';

const { version } = require('../package.json');

program
  .version(version, '-v, --version')
  .usage('<lint-md> [files...]')
  .description('lint your markdown files')
  .option(
    '-c, --config [configure-file]',
    'use the configure file, default .lintmdrc'
  )
  .option('-f, --fix', 'fix the errors automatically')
  .option(
    '-s, --suppress-warnings',
    'suppress all warnings, that means warnings will not blocked ci'
  )
  .arguments('[files...]')
  .action(async (files: string[], cmd: CliOptions) => {
    if (!files.length) {
      return;
    }

    const config = configure(cmd.config);
    const fix = cmd.fix;
    if (fix) {
      await new Fix(files, config).start();
    }
    else {
      const linter = new Lint(files, config);
      await linter.start();
      linter.showResult().printOverview();

      const { error, warning } = linter.countError();
      // 如果用户配置了 suppress warnings, 则不阻塞 ci
      const isWarningBlock = warning > 0 && !cmd.suppressWarnings;

      if (error > 0 || isWarningBlock) {
        process.exit(1);
      }
    }
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

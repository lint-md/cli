#!/usr/bin/env node

import * as program from 'commander';
import { Lint } from './lint';
import { Fix } from './fix';
import { configure } from './helper/configure';
import { CliOptions } from './types';

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
  .option('-f, --fix', 'fix the errors automatically')
  .arguments('[files...]')
  .action(async (files: string[], cmd: CliOptions) => {
    if (!files.length) {
      return;
    }
    const config = configure(cmd.config);
    const fix = cmd.fix;
    if (fix) {
      await new Fix(files, config).start();
    } else {
      const linter = new Lint(files, config);
      await linter.start();
      const data = linter.countError();
      console.log(data);
      linter.showResult().printOverview();
    }
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

#!/usr/bin/env node

import * as program from 'commander';
import { Lint } from './Lint';
import { Fix } from './Fix';
import { configure } from './helper/configure';
import { CliOptions } from './types';

const version = require('../package.json');

program
  .version(version, '-v, --version')
  .usage('<lint-md> <files...> [options]')
  .description('lint your markdown files')
  .option('-c, --config [configure-file]', 'use the configure file, default .lintmdrc')
  .option('-f, --fix', 'fix the errors automatically')
  .arguments('<files...>')
  .action((files: string[], cmd: CliOptions) => {
    const config = configure(cmd.config);
    const fix = cmd.fix;

    if (fix) {
      new Fix(files, config);
    } else {
      new Lint(files, config);
    }
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

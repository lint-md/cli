#!/usr/bin/env node

import * as process from 'process';
import { program } from 'commander';
import { Lint } from './lint';
import { Fix } from './fix';
import { configure, getConfig } from './helper/configure';
import type { CLIOptions } from './types';
import { loadMdFiles } from './helper/load-md-files';

const { version } = require('../package.json');

console.log('dev11');

program
  .version(
    version,
    '-v, --version',
    'output the version number（查看当前版本）'
  )
  .usage('<lint-md> [files...]')
  .description('lint your markdown files')
  .option(
    '-c, --config [configure-file]',
    'use the configure file, default .lintmdrc（使用配置文件，默认为 .lintmdrc）'
  )
  .option('-f, --fix', 'fix the errors automatically（开启修复模式）')
  .option(
    '-s, --suppress-warnings',
    'suppress all warnings, that means warnings will not block CI（抑制所有警告，这意味着警告不会阻止 CI）'
  )
  .arguments('[files...]')
  .action(async (files: string[], options: CLIOptions) => {
    const { fix, config, suppressWarnings, parallel } = options;
    if (!files.length) {
      return;
    }

    const finalConfig = getConfig(config);
    const mdFiles = await loadMdFiles(files, finalConfig);

    // console.log(mdFiles);
    //
    // const fix = options.fix;
    // if (fix) {
    //   await new Fix(files, config).start();
    // }
    // else {
    //   const linter = new Lint(files, config);
    //   await linter.start();
    //   linter.showResult().printOverview();
    //
    //   const { error, warning } = linter.countError();
    //   // 如果用户配置了 suppress warnings, 则不阻塞 ci
    //   const isWarningBlock = warning > 0 && !options.suppressWarnings;
    //
    //   if (error > 0 || isWarningBlock) {
    //     process.exit(1);
    //   }
    // }
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

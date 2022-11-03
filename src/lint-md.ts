#!/usr/bin/env node

import * as process from 'process';
import * as path from 'path';
import { program } from 'commander';
// @ts-expect-error
import { Piscina } from 'piscina';
import { getConfig } from './utils/configure';
import type { CLIOptions } from './types';
import { loadMdFiles } from './utils/load-md-files';
import type { LintWorkerOptions } from './utils/lint-worker';

const { version } = require('../package.json');

console.log(`dev -- version: ${version}`);

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
    const { fix, config, parallel = 1 } = options;
    if (!files.length) {
      return;
    }

    const { rules, excludeFiles } = getConfig(config);

    const mdFiles = await loadMdFiles(files, excludeFiles);

    const runner = new Piscina({
      filename: path.resolve(__dirname, 'utils', 'lint-worker'),
      maxThreads: parallel
    });

    const finalResult = await Promise.all(mdFiles.map((filePath) => {
      const lintWorkerOptions: LintWorkerOptions = {
        filePath,
        isFixMode: fix,
        rules,
      };

      return runner.run(lintWorkerOptions);
    }));

    console.log(finalResult);
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

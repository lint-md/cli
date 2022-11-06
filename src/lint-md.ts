#!/usr/bin/env node

import * as process from 'process';
import { cpus } from 'os';
import * as fs from 'fs-extra';
import { program } from 'commander';
import { batchLint } from './utils/batch-lint';
import { getLintConfig } from './utils/configure';
import type { CLIOptions } from './types';
import { loadMdFiles } from './utils/load-md-files';
import { getReportData } from './utils/get-report-data';

const { version } = require('../package.json');

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
  .option('-d, --dev', 'open dev mode（开启开发者模式）')
  .option(
    '-t, --threads [thread-count]',
    'The number of threads. The default is based on the number of available CPUs.（执行 Lint / Fix 的线程数，默认为 1）'
  )
  .option(
    '-s, --suppress-warnings',
    'suppress all warnings, that means warnings will not block CI（抑制所有警告，这意味着警告不会阻止 CI）'
  )
  .arguments('[files...]')
  .action(async (files: string[], options: CLIOptions) => {
    if (!files.length) {
      return;
    }

    const { fix, config, threads = '1', dev, suppressWarnings } = options;

    const startTime = new Date().getTime();
    const cpuSize = cpus().length;
    const isFixMode = Boolean(fix);
    const isDev = Boolean(dev);

    if (isDev) {
      console.log(`dev -- version: ${version}, ${new Date().toString()}`);
    }

    const { rules, excludeFiles } = getLintConfig(config);
    const threadsCount = threads ? Number(threads) : cpuSize;

    const mdFiles = await loadMdFiles(files, excludeFiles);

    try {
      const lintResult = await batchLint(
        threadsCount,
        mdFiles,
        isDev,
        isFixMode,
        rules
      );

      if (!isFixMode) {
        const { consoleMessage, errorCount } = getReportData(lintResult);

        console.log(consoleMessage);

        if (errorCount > 0 || (!suppressWarnings && errorCount === 0)) {
          process.exit(1);
        }
      }
      else {
        for (const lintResultElement of lintResult) {
          const { path, fixedResult } = lintResultElement;
          await fs.writeFile(path, fixedResult.result);
        }
      }
    }
    catch (e) {
      console.log(e);
    }

    if (isDev) {
      const endTime = new Date().getTime();
      console.log(`\nTime cost: ${endTime - startTime}ms`);
    }
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

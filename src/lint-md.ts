#!/usr/bin/env node

import * as process from 'process';
import * as fs from 'fs-extra';
import { program } from 'commander';
import { batchLint } from './utils/batch-lint';
import { getLintConfig, getThreadCount } from './utils/configure';
import type { CLIOptions } from './types';
import { loadMdFiles } from './utils/load-md-files';
import { getReportData } from './utils/get-report-data';

const { version } = require('../package.json');

const VALID_FORMATS = ['default', 'json'] as const;

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
  .option(
    '-F, --format <format>',
    'output format: default | json（输出格式，默认 default）',
    'default'
  )
  .arguments('[files...]')
  .action(async (files: string[], options: CLIOptions) => {
    if (!files.length) {
      return;
    }

    const { fix, config, threads, dev, suppressWarnings, format } = options;

    if (format && !VALID_FORMATS.includes(format)) {
      console.error(`Invalid format: ${format}. Valid values: ${VALID_FORMATS.join(', ')}`);
      process.exit(1);
      return;
    }

    const startTime = new Date().getTime();
    const isFixMode = Boolean(fix);
    const isDev = Boolean(dev);

    if (isDev) {
      if (format === 'json') {
        console.error(`dev -- version: ${version}, ${new Date().toString()}`);
      }
      else {
        console.log(`dev -- version: ${version}, ${new Date().toString()}`);
      }
    }

    const { rules, excludeFiles } = getLintConfig(config);

    const mdFiles = await loadMdFiles(files, excludeFiles);

    if (!mdFiles.length) {
      if (format === 'json') {
        console.log('[]');
      }
      else {
        console.log('🎉 No markdown files to lint 🎉');
      }
      process.exit(0);
      return;
    }

    try {
      const lintResult = await batchLint(
        getThreadCount(threads),
        mdFiles,
        isDev,
        isFixMode,
        rules
      );

      if (!isFixMode) {
        const { consoleMessage, errorCount, warningCount }
          = getReportData(lintResult, format);

        console.log(consoleMessage);

        // 错误数目大于 0 或者没有抑制警告并且警告数目不为 0
        if (errorCount > 0 || (!suppressWarnings && warningCount !== 0)) {
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
      console.error(e);
    }

    const endTime = new Date().getTime();
    if (format === 'default') {
      console.log(`⌛️Done in ${endTime - startTime}ms.`);
    }
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

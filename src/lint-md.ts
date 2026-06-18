#!/usr/bin/env node

import * as process from 'process';
import { readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { program } from 'commander';
import { lintMarkdown } from '@lint-md/core';
import { batchLint } from './utils/batch-lint';
import { getLintConfig, getThreadCount } from './utils/configure';
import type { CLIOptions } from './types';
import { loadMdFiles } from './utils/load-md-files';
import { getReportData } from './utils/get-report-data';

import { version } from '../package.json';

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
    '-i, --stdin',
    'read markdown content from stdin（从标准输入中读取内容）'
  )
  .arguments('[files...]')
  .action(async (files: string[], options: CLIOptions) => {
    const { fix, config, threads, dev, suppressWarnings, stdin } = options;

    const startTime = Date.now();
    const isFixMode = Boolean(fix);
    const isDev = Boolean(dev);

    if (isDev) {
      console.log(`dev -- version: ${version}, ${new Date().toString()}`);
    }

    const { rules, excludeFiles, extensions } = getLintConfig(config);

    // Handle stdin mode
    if (stdin) {
      const content = readFileSync(process.stdin.fd, 'utf8');

      if (!content.trim()) {
        console.log('🎉 No content to lint 🎉');
        process.exit(0);
        return;
      }

      try {
        const result = lintMarkdown(content, rules, isFixMode);

        if (isFixMode && result.fixedResult) {
          process.stdout.write(result.fixedResult.result);
        }
        else {
          const { consoleMessage, errorCount, warningCount }
            = getReportData([{ path: '(stdin)', lintResult: result.lintResult }]);

          console.log(consoleMessage);

          if (errorCount > 0 || (!suppressWarnings && warningCount !== 0)) {
            process.exit(1);
          }
        }
      }
      catch (e) {
        console.error(e);
        process.exit(1);
      }

      const endTime = new Date().getTime();
      console.log(`⌛️Done in ${endTime - startTime}ms.`);
      return;
    }

    if (!files.length) {
      return;
    }

    const mdFiles = await loadMdFiles(files, excludeFiles, extensions);

    if (!mdFiles.length) {
      console.log('🎉 No markdown files to lint 🎉');
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
          = getReportData(lintResult);

        console.log(consoleMessage);

        if (errorCount > 0 || (!suppressWarnings && warningCount !== 0)) {
          process.exit(1);
        }
      }
      else {
        await Promise.all(
          lintResult.flatMap(({ path, fixedResult }) =>
            fixedResult ? writeFile(path, fixedResult.result) : []
          )
        );
      }
    }
    catch (e) {
      console.error(e);
      process.exit(1);
    }

    const endTime = Date.now();
    console.log(`⌛️Done in ${endTime - startTime}ms.`);
  });

program.parse(process.argv);

const isStdin = process.argv.includes('--stdin') || process.argv.includes('-i');
if (!program.args.length && !isStdin) {
  program.help();
}

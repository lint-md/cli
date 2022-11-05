#!/usr/bin/env node

import * as process from 'process';
import * as path from 'path';
import { cpus } from 'os';
import type { lintMarkdown } from '@lint-md/core';
import * as fs from 'fs-extra';
import { program } from 'commander';
// @ts-expect-error
import { Piscina } from 'piscina';
import { averagedGroup } from './utils/averaged-group';
import { getLintConfig } from './utils/configure';
import type { CLIOptions, LintWorkerOptions } from './types';
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

    const mdFiles = await loadMdFiles(files, excludeFiles);

    const threadsCount = threads ? Number(threads) : cpuSize;

    const runner = new Piscina({
      filename: path.resolve(__dirname, 'utils', 'lint-worker'),
      maxThreads: threadsCount,
    });

    const fileContentList = await Promise.all(
      mdFiles.map((path) => {
        const call = async () => {
          const res = await fs.readFile(path);
          return {
            path,
            content: res.toString(),
          };
        };
        return call();
      })
    );

    // 将 md 文件内容进行分组，供各个线程分配执行
    const markdownContentGroup = averagedGroup(fileContentList, 10, (item) => {
      return item.content.length;
    });

    try {
      const res = await Promise.all(
        markdownContentGroup.map((groupItem) => {
          const asyncCall = async () => {
            const batchLintResult: ReturnType<typeof lintMarkdown>[]
              = await runner.run({
                contentList: groupItem.items.map((value) => {
                  return value.content;
                }),
                isFixMode,
                rules,
                isDev,
              } as LintWorkerOptions);

            return batchLintResult.map((lintResult, index) => {
              return {
                ...lintResult,
                path: groupItem.items[index].path,
              };
            });
          };

          return asyncCall();
        })
      );

      const problemResult = res.flat().filter((item) => {
        return item.lintResult.length > 0;
      });

      const problemMetaData = problemResult.map((res) => {
        const { path, lintResult } = res;

        const errorCount = lintResult.filter(
          item => item.severity === 2
        ).length;
        const warningCount = lintResult.filter(
          item => item.severity === 1
        ).length;

        if (errorCount + warningCount === 0) {
          return null;
        }

        return {
          errorCount,
          filePath: path,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          messages: lintResult.map((lintItem) => {
            const { loc, message, severity, name } = lintItem;
            return {
              column: loc.start.column,
              fatal: false,
              line: loc.start.line,
              message,
              ruleId: name,
              severity,
            };
          }),
          warningCount,
        };
      });

      const { consoleMessage, errorCount } = getReportData(problemMetaData.filter(Boolean));

      console.log(consoleMessage);

      if (errorCount > 0 || (!suppressWarnings && errorCount === 0)) {
        process.exit(1);
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

#!/usr/bin/env node

import * as process from "process";

const setExitCode = (code: number): void => {
  (globalThis as { process?: NodeJS.Process }).process!.exitCode = code;
};
import { readFileSync } from "fs";
import { Command } from "commander";
import { version } from "../package.json";
import { runStdinLint } from "./cli/run-lint";
import { safeWriteFile } from "./utils/safe-write-file";
import {
  batchLint,
  resolveAdaptiveConcurrency,
  runTasksWithLimit,
} from "./utils/batch-lint";
import {
  getLintConfig,
  getMaxFileSizeOption,
  getThreadCount,
} from "./utils/configure";
import type { ThreadCount } from "./types";
import { loadMdFiles } from "./utils/load-md-files";
import { getReportData } from "./utils/get-report-data";
import { filterFilesByMaxSize } from "./utils/filter-by-max-size";
import { getUnappliedFixesWarnings } from "./utils/report-unapplied-fixes";
import {
  getFixDevMetrics,
  getIncompleteFixWarnings,
} from "./utils/report-incomplete-fixes";
import { emitExecutionErrorsAndSetExitCode } from "./utils/report-execution-errors";
import { formatCoreError } from "./utils/format-core-error";

interface CLIOptions {
  fix?: boolean;
  dev?: boolean;
  config?: string;
  suppressWarnings: boolean;
  threads?: string | boolean;
  stdin?: boolean;
  maxFileSize?: string;
}

export const createProgram = (): Command => {
  const program = new Command();

  program
    .version(
      version,
      "-v, --version",
      "output the version number（查看当前版本）"
    )
    .usage("<lint-md> [files...]")
    .description("lint your markdown files")
    .option(
      "-c, --config [configure-file]",
      "use the configure file, default .lintmdrc（使用配置文件，默认为 .lintmdrc）"
    )
    .option("-f, --fix", "fix the errors automatically（开启修复模式）")
    .option("-d, --dev", "open dev mode（开启开发者模式）")
    .option(
      "-t, --threads [thread-count]",
      'Number of worker threads, or "auto" to cap concurrency for large files. Default: CPU count.（执行 Lint / Fix 的线程数，传 "auto" 时根据文件大小自适应）'
    )
    .option(
      "-s, --suppress-warnings",
      "suppress all warnings, that means warnings will not block CI（抑制所有警告，这意味着警告不会阻止 CI）"
    )
    .option(
      "-i, --stdin",
      "read markdown content from stdin（从标准输入中读取内容）"
    )
    .option(
      "--max-file-size <size>",
      "skip Markdown files larger than <size> (e.g. 5mb, 500kb, 1gb), warn to stderr（跳过超过指定大小的 Markdown 文件）"
    )
    .arguments("[files...]")
    .action(async (files: string[], options: CLIOptions) => {
      const {
        fix,
        config,
        threads,
        dev,
        suppressWarnings,
        stdin,
        maxFileSize,
      } = options;

      const startTime = Date.now();
      const isFixMode = Boolean(fix);
      const isDev = Boolean(dev);

      if (isDev) {
        console.log(`dev -- version: ${version}, ${new Date().toString()}`);
      }

      const { rules, excludeFiles, extensions } = getLintConfig(config);

      // --threads 参数校验，所有分支共用
      const threadCount: ThreadCount = getThreadCount(threads);

      // --max-file-size 校验（未传 = null = 不过滤），失败早退，与 --threads 一致
      const maxFileSizeBytes = getMaxFileSizeOption(maxFileSize);

      // Handle stdin mode
      if (stdin) {
        const content = readFileSync(process.stdin.fd, "utf8");
        runStdinLint({
          content,
          isDev,
          isFixMode,
          rules,
          startTime,
          suppressWarnings,
        });
        return;
      }

      if (!files.length) {
        return;
      }

      let mdFiles = await loadMdFiles(files, excludeFiles, extensions);

      // 过滤超大文件（stderr warning + 跳过），发生在 resolveAdaptiveConcurrency
      // 之前，使 --threads auto 只基于剩余文件重算并发，两者互不感知。
      if (maxFileSizeBytes !== null) {
        mdFiles = await filterFilesByMaxSize(mdFiles, maxFileSizeBytes);
      }

      if (!mdFiles.length) {
        console.log("🎉 No markdown files to lint 🎉");
        process.exit(0);
        return;
      }

      const concurrencyDecision = await resolveAdaptiveConcurrency(
        threadCount,
        mdFiles
      );
      const effectiveThreads = concurrencyDecision.concurrency;

      if (isDev && concurrencyDecision.maxFileSize !== null) {
        const { maxFileSize, requestedConcurrency } = concurrencyDecision;
        const adaptiveApplied = maxFileSize >= 1024 * 1024;
        if (adaptiveApplied && effectiveThreads < requestedConcurrency) {
          const maxMiB = (maxFileSize / (1024 * 1024)).toFixed(2);
          console.log(
            `[lint-md] Adaptive concurrency: requested auto, effective ${effectiveThreads}, max file ${maxMiB} MiB`
          );
        }
      }

      try {
        const { allResults, actionableResults } = await batchLint(
          effectiveThreads,
          mdFiles,
          isFixMode,
          rules
        );

        if (!isFixMode) {
          const { consoleMessage, errorCount, warningCount } =
            getReportData(actionableResults);

          console.log(consoleMessage);

          const hasRuleFailures =
            emitExecutionErrorsAndSetExitCode(actionableResults);

          if (
            errorCount > 0 ||
            (!suppressWarnings && warningCount !== 0) ||
            hasRuleFailures
          ) {
            setExitCode(1);
            return;
          }
        } else {
          await runTasksWithLimit(
            actionableResults
              .filter(({ fixedResult }) => fixedResult)
              .map(
                ({ path, fixedResult }) =>
                  () =>
                    safeWriteFile(path, fixedResult!.result)
              ),
            effectiveThreads
          );

          for (const warning of getIncompleteFixWarnings(actionableResults)) {
            console.error(warning);
          }
          for (const warning of getUnappliedFixesWarnings(actionableResults)) {
            console.error(warning);
          }
          const hasRuleFailures =
            emitExecutionErrorsAndSetExitCode(actionableResults);

          if (isDev) {
            for (const line of getFixDevMetrics(allResults)) {
              console.log(line);
            }
          }

          // Rule execution errors (core #185) are hard failures: emitted above
          // (after the fixes are written) and failed the CI run regardless of
          // --suppress-warnings. emitExecutionErrorsAndSetExitCode already set
          // process.exitCode = 1 so the written files and diagnostics flush.
          // Early-return so we don't print a trailing "Done in …" on failure,
          // matching the previous process.exit(1) behaviour.
          if (hasRuleFailures) {
            return;
          }
        }
      } catch (e) {
        const formatted = formatCoreError(e);
        console.error(formatted.handled ? formatted.message : e);
        process.exit(1);
      }

      const endTime = Date.now();
      console.log(`⌛️Done in ${endTime - startTime}ms.`);
    });

  return program;
};

export const main = async (argv: string[] = process.argv): Promise<void> => {
  const program = createProgram();
  await program.parseAsync(argv);

  const isStdin = argv.includes("--stdin") || argv.includes("-i");
  if (!program.args.length && !isStdin) {
    program.help();
  }
};

export const runCli = (argv: string[] = process.argv): void => {
  void main(argv).catch((error) => {
    console.error(error);
    setExitCode(1);
  });
};

if (require.main === module) {
  runCli();
}

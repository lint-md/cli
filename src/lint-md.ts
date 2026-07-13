#!/usr/bin/env node

import * as process from "process";

const setExitCode = (code: number): void => {
  (globalThis as { process?: NodeJS.Process }).process!.exitCode = code;
};
import { readFileSync } from "fs";
import { availableParallelism } from "os";
import { program } from "commander";
import { lintMarkdown } from "@lint-md/core";
import { version } from "../package.json";
import { safeWriteFile } from "./utils/safe-write-file";
import {
  batchLint,
  getMaxFileSize,
  resolveAdaptiveConcurrency,
  runTasksWithLimit,
} from "./utils/batch-lint";
import {
  getLintConfig,
  getMaxFileSizeOption,
  getThreadCount,
} from "./utils/configure";
import type { CLIOptions, ThreadCount } from "./types";
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
    const { fix, config, threads, dev, suppressWarnings, stdin, maxFileSize } =
      options;

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

      if (isFixMode) {
        if (content.length === 0) {
          return;
        }

        if (!content.trim()) {
          process.stdout.write(content);
          return;
        }

        try {
          const result = lintMarkdown(content, rules, true);
          process.stdout.write(result.fixedResult?.result ?? content);
          const stdinItem = {
            path: "(stdin)",
            lintResult: result.lintResult,
            fixedResult: result.fixedResult,
            fixableErrorCount: result.fixableErrorCount,
            fixableWarningCount: result.fixableWarningCount,
            executionErrors: result.executionErrors,
          };
          for (const warning of getIncompleteFixWarnings([stdinItem])) {
            console.error(warning);
          }
          emitExecutionErrorsAndSetExitCode([stdinItem]);
          if (isDev) {
            for (const line of getFixDevMetrics([stdinItem])) {
              console.error(line);
            }
          }
          return;
        } catch (e) {
          const formatted = formatCoreError(e);
          console.error(formatted.handled ? formatted.message : e);
          process.exit(1);
        }
      }

      if (!content.trim()) {
        console.error("No content to lint");
        process.exit(0);
      }

      try {
        const result = lintMarkdown(content, rules, false);
        const stdinItem = {
          path: "(stdin)",
          lintResult: result.lintResult,
          fixableErrorCount: result.fixableErrorCount,
          fixableWarningCount: result.fixableWarningCount,
          executionErrors: result.executionErrors,
        };
        const { consoleMessage, errorCount, warningCount } = getReportData([
          stdinItem,
        ]);

        console.log(consoleMessage);

        const hasRuleFailures = emitExecutionErrorsAndSetExitCode([stdinItem]);

        if (
          errorCount > 0 ||
          (!suppressWarnings && warningCount !== 0) ||
          hasRuleFailures
        ) {
          setExitCode(1);
          return;
        }
      } catch (e) {
        const formatted = formatCoreError(e);
        console.error(formatted.handled ? formatted.message : e);
        process.exit(1);
      }

      const endTime = new Date().getTime();
      console.log(`⌛️Done in ${endTime - startTime}ms.`);
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

    const effectiveThreads = await resolveAdaptiveConcurrency(
      threadCount,
      mdFiles
    );

    if (isDev && threadCount === "auto") {
      const maxFileSize = await getMaxFileSize(mdFiles);
      const adaptiveApplied = maxFileSize >= 1024 * 1024;
      const requested = availableParallelism();
      if (adaptiveApplied && effectiveThreads < requested) {
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

program.parse(process.argv);

const isStdin = process.argv.includes("--stdin") || process.argv.includes("-i");
if (!program.args.length && !isStdin) {
  program.help();
}

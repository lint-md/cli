import * as process from "process";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { LintMdRulesConfig } from "@lint-md/core";
import type { BatchLintItem, ThreadCount } from "../types";
import { safeWriteFile } from "../utils/safe-write-file";
import {
  batchLint,
  resolveAdaptiveConcurrency,
  runTasksWithLimit,
} from "../utils/batch-lint";
import { loadMdFiles } from "../utils/load-md-files";
import { filterFilesByMaxSize } from "../utils/filter-by-max-size";
import { formatCoreError } from "../utils/format-core-error";
import { getReportData } from "../utils/get-report-data";
import { getUnappliedFixesWarnings } from "../utils/report-unapplied-fixes";
import {
  getFixDevMetrics,
  getIncompleteFixWarnings,
} from "../utils/report-incomplete-fixes";
import { emitExecutionErrorsAndSetExitCode } from "../utils/report-execution-errors";
import { shouldFailLint } from "./should-fail-lint";

interface RunStdinLintOptions {
  content: string;
  isDev: boolean;
  isFixMode: boolean;
  rules: LintMdRulesConfig;
  startTime: number;
  suppressWarnings: boolean;
}

interface RunFileLintOptions {
  excludeFiles: string[];
  extensions: string[];
  files: string[];
  isDev: boolean;
  isFixMode: boolean;
  maxFileSizeBytes: number | null;
  rules: LintMdRulesConfig;
  startTime: number;
  suppressWarnings: boolean;
  threadCount: ThreadCount;
}

const setExitCode = (code: number): void => {
  (globalThis as { process?: NodeJS.Process }).process!.exitCode = code;
};

export const runStdinLint = ({
  content,
  isDev,
  isFixMode,
  rules,
  startTime,
  suppressWarnings,
}: RunStdinLintOptions): void => {
  if (isFixMode) {
    if (content.length === 0) {
      return;
    }

    if (!content.trim()) {
      process.stdout.write(content);
      return;
    }

    try {
      const result = fixMarkdown(content, { rules });
      process.stdout.write(result.fixedResult?.result ?? content);
      const stdinItem: BatchLintItem = {
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
    } catch (error) {
      const formatted = formatCoreError(error);
      console.error(formatted.handled ? formatted.message : error);
      process.exit(1);
    }
  }

  if (!content.trim()) {
    console.error("No content to lint");
    process.exit(0);
  }

  try {
    const result = lintMarkdown(content, rules, false);
    const stdinItem: BatchLintItem = {
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
      shouldFailLint({
        errorCount,
        hasRuleFailures,
        suppressWarnings,
        warningCount,
      })
    ) {
      setExitCode(1);
      return;
    }
  } catch (error) {
    const formatted = formatCoreError(error);
    console.error(formatted.handled ? formatted.message : error);
    process.exit(1);
  }

  const endTime = Date.now();
  console.log(`⌛️Done in ${endTime - startTime}ms.`);
};

export const runFileLint = async ({
  excludeFiles,
  extensions,
  files,
  isDev,
  isFixMode,
  maxFileSizeBytes,
  rules,
  startTime,
  suppressWarnings,
  threadCount,
}: RunFileLintOptions): Promise<void> => {
  if (!files.length) {
    return;
  }

  let mdFiles = await loadMdFiles(files, excludeFiles, extensions);

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
        shouldFailLint({
          errorCount,
          hasRuleFailures,
          suppressWarnings,
          warningCount,
        })
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

      if (hasRuleFailures) {
        return;
      }
    }
  } catch (error) {
    const formatted = formatCoreError(error);
    console.error(formatted.handled ? formatted.message : error);
    process.exit(1);
  }

  const endTime = Date.now();
  console.log(`⌛️Done in ${endTime - startTime}ms.`);
};

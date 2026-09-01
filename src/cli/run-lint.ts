import * as process from "process";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { LintMdRulesConfig } from "@lint-md/core";
import type { ThreadCount } from "../types";
import { safeWriteFile } from "../utils/safe-write-file";
import { resolveAdaptiveConcurrency } from "../utils/adaptive-concurrency";
import { batchLint } from "../utils/batch-lint";
import { loadMdFiles } from "../utils/load-md-files";
import { filterFilesByMaxSize } from "../utils/filter-by-max-size";
import { getMaxFileSize, statFiles, type FileStat } from "../utils/file-stat";
import { formatCoreError } from "../utils/format-core-error";
import { formatLintReport } from "../utils/format-lint-report";
import { getUnappliedFixesWarnings } from "../utils/report-unapplied-fixes";
import {
  getFixDevMetrics,
  getIncompleteFixWarnings,
} from "../utils/report-incomplete-fixes";
import { getExecutionErrorWarnings } from "../utils/report-execution-errors";
import { runTasksWithLimit } from "../utils/run-tasks-with-limit";
import { summarizeLintResults } from "../utils/summarize-lint-results";
import { sanitizeTerminalText } from "../utils/sanitize-terminal";
import { toBatchLintItem } from "../utils/to-batch-lint-item";
import {
  FAILURE_EXIT,
  SUCCESS_EXIT,
  type CliExitOutcome,
} from "./exit-outcome";
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

export const runStdinLint = ({
  content,
  isDev,
  isFixMode,
  rules,
  startTime,
  suppressWarnings,
}: RunStdinLintOptions): CliExitOutcome => {
  if (isFixMode) {
    if (content.length === 0) {
      return SUCCESS_EXIT;
    }

    if (!content.trim()) {
      process.stdout.write(content);
      return SUCCESS_EXIT;
    }

    try {
      const result = fixMarkdown(content, { rules });
      process.stdout.write(result.fixedResult?.result ?? content);
      const stdinItem = toBatchLintItem("(stdin)", result);
      for (const warning of getIncompleteFixWarnings([stdinItem])) {
        console.error(warning);
      }
      const executionErrorWarnings = getExecutionErrorWarnings([stdinItem]);
      for (const warning of executionErrorWarnings) {
        console.error(warning);
      }
      if (isDev) {
        for (const line of getFixDevMetrics([stdinItem])) {
          console.error(line);
        }
      }
      return executionErrorWarnings.length > 0 ? FAILURE_EXIT : SUCCESS_EXIT;
    } catch (error) {
      const formatted = formatCoreError(error);
      console.error(formatted.handled ? formatted.message : error);
      return FAILURE_EXIT;
    }
  }

  if (!content.trim()) {
    console.error("No content to lint");
    return SUCCESS_EXIT;
  }

  try {
    const result = lintMarkdown(content, rules, false);
    const stdinItem = toBatchLintItem("(stdin)", result);
    const summary = summarizeLintResults([stdinItem]);

    console.log(formatLintReport(summary));

    const executionErrorWarnings = getExecutionErrorWarnings([stdinItem]);
    for (const warning of executionErrorWarnings) {
      console.error(warning);
    }
    const hasRuleFailures = executionErrorWarnings.length > 0;

    if (
      shouldFailLint({
        errorCount: summary.errorCount,
        hasRuleFailures,
        suppressWarnings,
        warningCount: summary.warningCount,
      })
    ) {
      return FAILURE_EXIT;
    }
  } catch (error) {
    const formatted = formatCoreError(error);
    console.error(formatted.handled ? formatted.message : error);
    return FAILURE_EXIT;
  }

  const endTime = Date.now();
  console.log(`⌛️Done in ${endTime - startTime}ms.`);
  return SUCCESS_EXIT;
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
}: RunFileLintOptions): Promise<CliExitOutcome> => {
  if (!files.length) {
    return SUCCESS_EXIT;
  }

  let mdFiles = await loadMdFiles(files, excludeFiles, extensions);

  // Empty discovery stays a success so local usage keeps exit 0.
  // The message names the cause instead of a generic "no files" note.
  if (!mdFiles.length) {
    const patterns = files
      .map((file) => JSON.stringify(sanitizeTerminalText(file)))
      .join(", ");
    console.error(`[lint-md] No Markdown files matched: ${patterns}`);
    return SUCCESS_EXIT;
  }

  let fileStats: FileStat[] = [];
  if (maxFileSizeBytes !== null || threadCount === "auto") {
    fileStats = await statFiles(mdFiles);
  }

  if (maxFileSizeBytes !== null) {
    fileStats = filterFilesByMaxSize(fileStats, maxFileSizeBytes);
    mdFiles = fileStats.map(({ path }) => path);

    if (!mdFiles.length) {
      console.error(
        "[lint-md] No Markdown files remain after file-size filtering."
      );
      return SUCCESS_EXIT;
    }
  }

  const concurrencyDecision = await resolveAdaptiveConcurrency(
    threadCount,
    mdFiles,
    getMaxFileSize(fileStats)
  );
  const effectiveThreads = concurrencyDecision.concurrency;

  if (isDev && concurrencyDecision.maxFileSize !== null) {
    const { maxFileSize, requestedConcurrency } = concurrencyDecision;
    if (effectiveThreads < requestedConcurrency) {
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
      const summary = summarizeLintResults(actionableResults);

      console.log(formatLintReport(summary));

      const executionErrorWarnings =
        getExecutionErrorWarnings(actionableResults);
      for (const warning of executionErrorWarnings) {
        console.error(warning);
      }
      const hasRuleFailures = executionErrorWarnings.length > 0;

      if (
        shouldFailLint({
          errorCount: summary.errorCount,
          hasRuleFailures,
          suppressWarnings,
          warningCount: summary.warningCount,
        })
      ) {
        return FAILURE_EXIT;
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
      const executionErrorWarnings =
        getExecutionErrorWarnings(actionableResults);
      for (const warning of executionErrorWarnings) {
        console.error(warning);
      }
      const hasRuleFailures = executionErrorWarnings.length > 0;

      if (isDev) {
        for (const line of getFixDevMetrics(allResults)) {
          console.log(line);
        }
      }

      if (hasRuleFailures) {
        return FAILURE_EXIT;
      }
    }
  } catch (error) {
    const formatted = formatCoreError(error);
    console.error(formatted.handled ? formatted.message : error);
    return FAILURE_EXIT;
  }

  const endTime = Date.now();
  console.log(`⌛️Done in ${endTime - startTime}ms.`);
  return SUCCESS_EXIT;
};

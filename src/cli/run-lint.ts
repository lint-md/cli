import * as process from "process";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { LintMdRulesConfig } from "@lint-md/core";
import type { BatchLintItem } from "../types";
import { formatCoreError } from "../utils/format-core-error";
import { getReportData } from "../utils/get-report-data";
import {
  getFixDevMetrics,
  getIncompleteFixWarnings,
} from "../utils/report-incomplete-fixes";
import { emitExecutionErrorsAndSetExitCode } from "../utils/report-execution-errors";

interface RunStdinLintOptions {
  content: string;
  isDev: boolean;
  isFixMode: boolean;
  rules: LintMdRulesConfig;
  startTime: number;
  suppressWarnings: boolean;
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
      errorCount > 0 ||
      (!suppressWarnings && warningCount !== 0) ||
      hasRuleFailures
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

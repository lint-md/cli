import type { LintReportItem } from "@lint-md/core";
import type { BatchLintItem } from "../types";

export interface LintMessageSummary {
  column: number;
  line: number;
  message: string;
  ruleId: string;
  severity: LintReportItem["severity"];
}

export interface FileLintSummary {
  errorCount: number;
  filePath: string;
  fixableErrorCount: number;
  fixableWarningCount: number;
  messages: LintMessageSummary[];
  warningCount: number;
}

export interface LintSummary {
  errorCount: number;
  files: FileLintSummary[];
  fixableErrorCount: number;
  fixableWarningCount: number;
  warningCount: number;
}

export const summarizeLintResults = (items: BatchLintItem[]): LintSummary => {
  const summary: LintSummary = {
    errorCount: 0,
    files: [],
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    warningCount: 0,
  };

  for (const item of items) {
    const errorCount = item.lintResult.filter(
      ({ severity }) => severity === 2
    ).length;
    const warningCount = item.lintResult.filter(
      ({ severity }) => severity === 1
    ).length;

    if (errorCount + warningCount === 0) {
      continue;
    }

    const fixableErrorCount = item.fixableErrorCount ?? 0;
    const fixableWarningCount = item.fixableWarningCount ?? 0;

    summary.files.push({
      errorCount,
      filePath: item.path,
      fixableErrorCount,
      fixableWarningCount,
      messages: item.lintResult.map(({ loc, message, name, severity }) => ({
        column: loc.start.column,
        line: loc.start.line,
        message,
        ruleId: name,
        severity,
      })),
      warningCount,
    });
    summary.errorCount += errorCount;
    summary.warningCount += warningCount;
    summary.fixableErrorCount += fixableErrorCount;
    summary.fixableWarningCount += fixableWarningCount;
  }

  return summary;
};

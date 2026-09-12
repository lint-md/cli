import type { LintDiagnostic } from "@lint-md/core";
import type { BatchLintItem } from "../types";

export interface LintMessageSummary {
  column: number;
  line: number;
  message: string;
  ruleId: string;
  severity: LintDiagnostic["severity"];
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
    const { errorCount, warningCount, fixableErrorCount, fixableWarningCount } =
      item.summary;

    if (errorCount + warningCount === 0) {
      continue;
    }

    summary.files.push({
      errorCount,
      filePath: item.path,
      fixableErrorCount,
      fixableWarningCount,
      messages: item.diagnostics.map(
        ({ range, message, ruleId, severity }) => ({
          column: range!.start.column,
          line: range!.start.line,
          message,
          ruleId,
          severity,
        })
      ),
      warningCount,
    });
    summary.errorCount += errorCount;
    summary.warningCount += warningCount;
    summary.fixableErrorCount += fixableErrorCount;
    summary.fixableWarningCount += fixableWarningCount;
  }

  return summary;
};

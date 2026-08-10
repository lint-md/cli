import type { LintMdResult } from "@lint-md/core";
import type { BatchLintItem } from "../types";

export const toBatchLintItem = (
  path: string,
  result: LintMdResult
): BatchLintItem => ({
  path,
  lintResult: result.lintResult,
  fixedResult: result.fixedResult,
  fixableErrorCount: result.fixableErrorCount,
  fixableWarningCount: result.fixableWarningCount,
  executionErrors: result.executionErrors,
});

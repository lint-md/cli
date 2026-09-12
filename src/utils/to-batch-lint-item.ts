import type { LintMdResult } from "@lint-md/core";
import type { BatchLintItem } from "../types";

export const toBatchLintItem = (
  path: string,
  result: LintMdResult
): BatchLintItem => ({
  path,
  diagnostics: result.diagnostics,
  summary: result.summary,
  fixedResult: result.fixedResult,
  executionErrors: result.executionErrors,
});

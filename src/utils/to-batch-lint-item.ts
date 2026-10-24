import type { LintMdResult } from "@lint-md/core";
import type { BatchLintItem } from "../types";

export const toBatchLintItem = (
  path: string,
  result: LintMdResult,
  changed: boolean
): BatchLintItem => ({
  path,
  diagnostics: result.diagnostics,
  summary: result.summary,
  ...(result.fixedResult && { remainingSummary: result.remainingSummary }),
  fixedResult: result.fixedResult,
  changed,
  executionErrors: result.executionErrors,
});

import type { BatchLintItem } from "../types";
import { sanitizeTerminalText } from "./sanitize-terminal";

// @lint-md/core 2.1.5 (core #185) returns rule execution errors as a
// structured list instead of throwing or logging implicitly. CLI surfaces
// them on a dedicated stderr channel (not mixed into getReportData's
// lint/warning counts) and exits 1 regardless of --suppress-warnings, since
// a rule crashing is a hard failure, not a document-level lint finding.

export const hasExecutionErrors = (items: BatchLintItem[]): boolean =>
  items.some((item) => (item.executionErrors?.length ?? 0) > 0);

export const getExecutionErrorWarnings = (items: BatchLintItem[]): string[] => {
  const warnings: string[] = [];

  for (const item of items) {
    const errors = item.executionErrors;
    if (!errors || errors.length === 0) {
      continue;
    }

    for (const error of errors) {
      const { ruleName, message, phase, round, nodeType } = error;
      const pathText = sanitizeTerminalText(item.path);
      const ruleText = sanitizeTerminalText(ruleName);
      const messageText = sanitizeTerminalText(message);
      const nodeText = nodeType ? sanitizeTerminalText(nodeType) : undefined;

      const location = nodeText
        ? ` (round ${round}, node ${nodeText})`
        : ` (round ${round})`;

      warnings.push(
        `[lint-md] ${pathText}: ${ruleText} failed in ${phase}${location}: ${messageText}`
      );
    }
  }

  return warnings;
};

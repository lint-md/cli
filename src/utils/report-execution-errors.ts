import type { BatchLintItem } from "../types";
import { sanitizeTerminalText } from "./sanitize-terminal";

// Core returns rule execution errors as structured data.
// The CLI writes these errors to stderr.
// These errors do not change lint counts.
// A rule crash always causes exit 1.
// --suppress-warnings does not suppress rule crashes.

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

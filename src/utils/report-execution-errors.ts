import process from "process";
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

/**
 * Writes one diagnostic line per execution error to the given stream and
 * returns true if any errors were reported. Callers should set
 * `process.exitCode = 1` (NOT call `process.exit(1)`) so stdout/stderr
 * finish flushing on pipe-based stdin flows.
 */
export const reportExecutionErrors = (
  items: BatchLintItem[],
  stream: NodeJS.WritableStream = process.stderr
): boolean => {
  let wrote = false;
  for (const line of getExecutionErrorWarnings(items)) {
    stream.write(`${line}\n`);
    wrote = true;
  }
  return wrote;
};

/**
 * Surfaces execution errors on the default stderr channel and sets
 * `process.exitCode = 1` when any are present. Setting the exit code (not
 * calling `process.exit(1)`) lets stdout/stderr finish flushing, which
 * matters for pipe-based stdin flows such as
 * `cat README.md | lint-md --stdin --fix > README.fixed.md`.
 *
 * Returns true when errors were present so the four CLI entry points can
 * also fold this into their existing exit decision without a second pass.
 */
export const emitExecutionErrorsAndSetExitCode = (
  items: BatchLintItem[]
): boolean => {
  const reported = reportExecutionErrors(items);
  if (reported) {
    process.exitCode = 1;
  }
  return reported;
};

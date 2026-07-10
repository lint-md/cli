import type { BatchLintItem } from '../types';
import { sanitizeTerminalText } from './sanitize-terminal';

// Returns stderr warning lines for files whose --fix pass left fixes
// unapplied due to conflicts. `fixedResult.notAppliedFixes` (from
// @lint-md/core) contains only the final-round conflicting fixes after
// core stopped dropping them across rounds, so the range coordinates are
// based on the returned result text and safe to report directly.
export const getUnappliedFixesWarnings = (lintResult: BatchLintItem[]): string[] => {
  const warnings: string[] = [];

  for (const item of lintResult) {
    const count = item.fixedResult?.notAppliedFixes?.length ?? 0;
    if (count > 0) {
      warnings.push(
        `[lint-md] ${sanitizeTerminalText(item.path)}: ${count} fixes were not applied due to conflicts.`
      );
    }
  }

  return warnings;
};

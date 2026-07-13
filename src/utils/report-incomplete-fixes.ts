import type { BatchLintItem } from "../types";
import { FixConvergence } from "@lint-md/core";
import { sanitizeTerminalText } from "./sanitize-terminal";

// @lint-md/core 2.1.5 (see core #182) exposes an optional
// `convergence: "stable" | "cycle" | "max"` on FixedResult. CLI treats
// `cycle` (oscillation) and `max` (MAX_ROUNDS truncation) as quality
// warnings, never hard errors — the fix pass still produced output.
const INCOMPLETE_CONVERGENCE: ReadonlySet<FixConvergence> = new Set([
  FixConvergence.CYCLE_DETECTED,
  FixConvergence.MAX_ROUNDS,
]);

export const isIncompleteFix = (item: BatchLintItem): boolean => {
  const convergence = item.fixedResult?.convergence;
  return convergence !== undefined && INCOMPLETE_CONVERGENCE.has(convergence);
};

export const getIncompleteFixWarnings = (
  lintResult: BatchLintItem[]
): string[] => {
  const warnings: string[] = [];

  for (const item of lintResult) {
    const convergence = item.fixedResult?.convergence;
    if (convergence !== undefined && INCOMPLETE_CONVERGENCE.has(convergence)) {
      warnings.push(
        `[lint-md] Fix did not fully converge for ${sanitizeTerminalText(
          item.path
        )}: ${convergence}.`
      );
    }
  }

  return warnings;
};

export const getFixDevMetrics = (lintResult: BatchLintItem[]): string[] => {
  const lines: string[] = [];

  for (const item of lintResult) {
    const metrics = item.fixedResult?.metrics;
    if (!metrics) {
      continue;
    }
    const convergence = item.fixedResult?.convergence ?? "unknown";
    const wallTime = metrics.wallTime.toFixed(2);
    lines.push(
      `[lint-md] Fix metrics: ${sanitizeTerminalText(
        item.path
      )}: convergence=${convergence}, rounds=${
        metrics.rounds
      }, wallTime=${wallTime}ms`
    );
  }

  return lines;
};

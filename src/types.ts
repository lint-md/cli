/** CLI 配置 */
import type {
  LintMdRulesConfig,
  LintDiagnostic,
  LintSummary,
  FixedResult,
  RuleExecutionError,
} from "@lint-md/core";

export type ThreadCount = number | "auto";

export interface CLIConfig {
  excludeFiles?: string[];
  rules?: LintMdRulesConfig;
  extensions?: string[];
}

export interface LintWorkerOptions {
  filePath: string;
  rules?: LintMdRulesConfig;
  isFixMode: boolean;
}

/** Compact fixed-result for clean files (no diagnostics, no unapplied fixes).
 *  Only carries the fields getFixDevMetrics needs. The full FixedResult.result
 *  (repair Markdown text) is intentionally absent to avoid structured-cloning
 *  large strings across the worker thread boundary.
 *
 *  `result` and `notAppliedFixes` are declared optional so TypeScript allows
 *  narrowing the union with `"prop" in obj` checks. At runtime, compact objects
 *  never carry these fields — the memory saving is real. */
export interface CompactFixedResult {
  result?: FixedResult["result"];
  notAppliedFixes?: FixedResult["notAppliedFixes"];
  metrics?: FixedResult["metrics"];
  convergence?: FixedResult["convergence"];
}

/** Type guard: true when fixedResult carries the full Markdown text
 *  (result + notAppliedFixes). Compact results from the worker have
 *  these fields absent at runtime. */
export const isFullFixedResult = (
  fixedResult: FixedResult | CompactFixedResult
): fixedResult is FixedResult =>
  "result" in fixedResult && "notAppliedFixes" in fixedResult;

/** batchLint 单个文件的 lint 结果 */
export interface BatchLintItem {
  path: string;
  diagnostics: LintDiagnostic[];
  summary: LintSummary;
  fixedResult?: FixedResult | CompactFixedResult | null;
  // Per-round, per-phase rule execution errors from @lint-md/core 2.1.5
  // (core #185). CLI surfaces these as stderr warnings and exits 1
  // regardless of --suppress-warnings.
  executionErrors?: RuleExecutionError[];
}

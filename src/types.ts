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

/** batchLint 单个文件的 lint 结果 */
export interface BatchLintItem {
  path: string;
  diagnostics: LintDiagnostic[];
  summary: LintSummary;
  fixedResult?: FixedResult | null;
  // Per-round, per-phase rule execution errors from @lint-md/core 2.1.5
  // (core #185). CLI surfaces these as stderr warnings and exits 1
  // regardless of --suppress-warnings.
  executionErrors?: RuleExecutionError[];
}

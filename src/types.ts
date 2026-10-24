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
  remainingSummary?: LintSummary;
  fixedResult?: FixedResult | null;
  // True only when fix mode changed the content. The main thread writes a
  // file only when this is true. Required so a new result path cannot
  // silently skip every write: each producer must state the value.
  changed: boolean;
  // Per-round, per-phase rule execution errors from @lint-md/core 2.1.5
  // (core #185). CLI surfaces these as stderr warnings and exits 1
  // regardless of --suppress-warnings.
  executionErrors?: RuleExecutionError[];
}

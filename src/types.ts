/** CLI 配置 */
import type {
  LintMdRulesConfig,
  LintReportItem,
  FixedResult,
  RuleExecutionError,
} from "@lint-md/core";

export type ThreadCount = number | "auto";

export interface CLIConfig {
  excludeFiles?: string[];
  rules?: LintMdRulesConfig;
  extensions?: string[];
}

/** 用户传入的 CLI 选项 */
export interface CLIOptions {
  fix?: boolean;
  dev?: boolean;
  config?: string;
  suppressWarnings: boolean;
  threads?: string | boolean;
  stdin?: boolean;
  maxFileSize?: string;
}

/** CLI lint 结果选项 */
export interface CLILintResult {
  path: string;
  file: string;
}

/** CLI lint 错误统计信息 */
export interface CliErrorCount {
  error: number;
  warning: number;
}

export interface LintWorkerOptions {
  filePath: string;
  rules?: LintMdRulesConfig;
  isFixMode?: boolean;
}

/** batchLint 单个文件的 lint 结果 */
export interface BatchLintItem {
  path: string;
  lintResult: LintReportItem[];
  fixedResult?: FixedResult | null;
  fixableErrorCount?: number;
  fixableWarningCount?: number;
  // Per-round, per-phase rule execution errors from @lint-md/core 2.1.5
  // (core #185). CLI surfaces these as stderr warnings and exits 1
  // regardless of --suppress-warnings.
  executionErrors?: RuleExecutionError[];
}

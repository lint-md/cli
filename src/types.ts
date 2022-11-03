import type { LintMdError, LintMdRulesConfig } from '@lint-md/core';

/** CLI 配置 */
export interface CLIConfig {
  excludeFiles?: string[]
  rules: LintMdRulesConfig
}

/** 用户传入的 CLI 选项 */
export interface CLIOptions {
  fix?: boolean
  config?: string
  suppressWarnings: boolean
  parallel?: number
}

/** CLI lint 结果选项 */
export interface CLILintResult {
  path: string
  file: string
  errors: LintMdError[]
}

/** CLI lint 错误统计信息 */
export interface CliErrorCount {
  error: number
  warning: number
}

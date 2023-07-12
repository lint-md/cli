/** CLI 配置 */
import type { LintMdRulesConfig } from '@lint-md/core';

export interface CLIConfig {
  excludeFiles?: string[]
  rules: LintMdRulesConfig
}

/** 用户传入的 CLI 选项 */
export interface CLIOptions {
  fix?: boolean
  dev?: boolean
  config?: string
  suppressWarnings: boolean
  threads?: string | boolean
}

/** CLI lint 结果选项 */
export interface CLILintResult {
  path: string
  file: string
}

/** CLI lint 错误统计信息 */
export interface CliErrorCount {
  error: number
  warning: number
}

export interface LintWorkerOptions {
  contentList: string[]
  rules?: LintMdRulesConfig
  isFixMode?: boolean
  isDev?: boolean
}

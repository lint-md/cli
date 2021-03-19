import { LintMdError, LintMdRulesConfig } from 'lint-md';

export interface CliConfig {
  excludeFiles: string[]
  rules: LintMdRulesConfig
}

export interface CliOptions {
  fix?: boolean
  config?: string
}

export interface CliLintResult {
  path: string
  file: string
  errors: LintMdError[]
}
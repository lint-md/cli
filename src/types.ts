import { LintMdError, LintMdRulesConfig } from '@lint-md/core';

// cli 配置
export interface CliConfig {
  excludeFiles?: string[];
  rules: LintMdRulesConfig;
}

// 用户传入的 cli 选项
export interface CliOptions {
  fix?: boolean;
  config?: string;
  suppressWarnings: boolean;
}

// cli lint 结果选项
export interface CliLintResult {
  path: string;
  file: string;
  errors: LintMdError[];
}

// cli lint 错误统计信息
export interface CliErrorCount {
  error: number;
  warning: number;
}

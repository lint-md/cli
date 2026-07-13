import { sanitizeTerminalText } from "./sanitize-terminal";

type FormattedCoreError =
  | { handled: true; message: string }
  | { handled: false };

const UNKNOWN_RULE_PATTERN =
  /^\[lint-md\] 未知规则 (.+) 的配置格式非法，第三方规则必须使用 \[rule, severity, options\] 形式$/u;
const DUPLICATE_ALIAS_PATTERN =
  /^\[lint-md\] 规则别名冲突：(.+) 已被另一规则占用$/u;

/**
 * Converts the known configuration errors introduced by @lint-md/core 2.1.5
 * into stable CLI diagnostics. Unknown errors deliberately remain unhandled
 * so that programming and runtime failures retain their original details.
 */
export const formatCoreError = (error: unknown): FormattedCoreError => {
  if (!(error instanceof Error)) {
    return { handled: false };
  }

  const unknownRule = error.message.match(UNKNOWN_RULE_PATTERN);
  if (unknownRule) {
    const ruleName = sanitizeTerminalText(unknownRule[1]);
    return {
      handled: true,
      message: [
        `[lint-md] Configuration error: unknown rule "${ruleName}" has an invalid configuration.`,
        "Third-party rules must use [rule, severity, options].",
      ].join("\n"),
    };
  }

  const duplicateAlias = error.message.match(DUPLICATE_ALIAS_PATTERN);
  if (duplicateAlias) {
    const alias = sanitizeTerminalText(duplicateAlias[1]);
    return {
      handled: true,
      message: [
        `[lint-md] Configuration error: duplicate rule alias "${alias}".`,
        'Check the "rules" section in .lintmdrc.',
      ].join("\n"),
    };
  }

  return { handled: false };
};

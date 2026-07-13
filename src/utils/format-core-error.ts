import { sanitizeTerminalText } from "./sanitize-terminal";

type FormattedCoreError =
  | { handled: true; message: string }
  | { handled: false };

const UNKNOWN_RULE_PREFIX = "[lint-md] 未知规则 ";
const UNKNOWN_RULE_SUFFIX =
  " 的配置格式非法，第三方规则必须使用 [rule, severity, options] 形式";
const DUPLICATE_ALIAS_PREFIX = "[lint-md] 规则别名冲突：";
const DUPLICATE_ALIAS_SUFFIX = " 已被另一规则占用";

const extractBetween = (
  message: string,
  prefix: string,
  suffix: string
): string | null => {
  if (!message.startsWith(prefix) || !message.endsWith(suffix)) {
    return null;
  }

  return message.slice(prefix.length, message.length - suffix.length);
};

/**
 * Converts the known configuration errors introduced by @lint-md/core 2.1.5
 * into stable CLI diagnostics. Unknown errors deliberately remain unhandled
 * so that programming and runtime failures retain their original details.
 */
export const formatCoreError = (error: unknown): FormattedCoreError => {
  if (!(error instanceof Error)) {
    return { handled: false };
  }

  const unknownRule = extractBetween(
    error.message,
    UNKNOWN_RULE_PREFIX,
    UNKNOWN_RULE_SUFFIX
  );
  if (unknownRule !== null) {
    const ruleName = sanitizeTerminalText(unknownRule);
    return {
      handled: true,
      message: [
        `[lint-md] Configuration error: unknown rule "${ruleName}" has an invalid configuration.`,
        "Third-party rules must use [rule, severity, options].",
      ].join("\n"),
    };
  }

  const duplicateAlias = extractBetween(
    error.message,
    DUPLICATE_ALIAS_PREFIX,
    DUPLICATE_ALIAS_SUFFIX
  );
  if (duplicateAlias !== null) {
    const alias = sanitizeTerminalText(duplicateAlias);
    return {
      handled: true,
      message: [
        `[lint-md] Configuration error: duplicate rule alias "${alias}".`,
        'Check the "rules" section in your lint-md configuration file.',
      ].join("\n"),
    };
  }

  return { handled: false };
};

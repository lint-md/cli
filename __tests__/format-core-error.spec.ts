import { formatCoreError } from "../src/utils/format-core-error";

describe("formatCoreError", () => {
  test("formats the core unknown-rule configuration error", () => {
    const result = formatCoreError(
      new TypeError(
        "[lint-md] 未知规则 custom-rule 的配置格式非法，第三方规则必须使用 [rule, severity, options] 形式"
      )
    );

    expect(result).toEqual({
      handled: true,
      message:
        '[lint-md] Configuration error: unknown rule "custom-rule" has an invalid configuration.\nThird-party rules must use [rule, severity, options].',
    });
  });

  test("formats the core duplicate-alias configuration error", () => {
    const result = formatCoreError(
      new TypeError("[lint-md] 规则别名冲突：custom-rule 已被另一规则占用")
    );

    expect(result).toEqual({
      handled: true,
      message:
        '[lint-md] Configuration error: duplicate rule alias "custom-rule".\nCheck the "rules" section in your lint-md configuration file.',
    });
  });

  test("formats and sanitizes a multiline unknown rule name", () => {
    const ruleName = "evil\n\r\u001B[31mred\u001B[0m\u001B]spoof\u0007name";
    const result = formatCoreError(
      new TypeError(
        `[lint-md] 未知规则 ${ruleName} 的配置格式非法，第三方规则必须使用 [rule, severity, options] 形式`
      )
    );

    expect(result).toEqual({
      handled: true,
      message:
        '[lint-md] Configuration error: unknown rule "evil^J^Mredname" has an invalid configuration.\nThird-party rules must use [rule, severity, options].',
    });
  });

  test("leaves unrelated errors unhandled", () => {
    expect(formatCoreError(new TypeError("unrelated failure"))).toEqual({
      handled: false,
    });
    expect(formatCoreError("unrelated failure")).toEqual({ handled: false });
  });
});

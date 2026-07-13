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
        '[lint-md] Configuration error: duplicate rule alias "custom-rule".\nCheck the "rules" section in .lintmdrc.',
    });
  });

  test("leaves unrelated errors unhandled", () => {
    expect(formatCoreError(new TypeError("unrelated failure"))).toEqual({
      handled: false,
    });
    expect(formatCoreError("unrelated failure")).toEqual({ handled: false });
  });
});

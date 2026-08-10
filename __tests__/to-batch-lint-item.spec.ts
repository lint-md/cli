import type { LintMdFixResult, LintMdLintResult } from "@lint-md/core";
import { toBatchLintItem } from "../src/utils/to-batch-lint-item";

describe("toBatchLintItem", () => {
  test("adapts a lint result", () => {
    const result: LintMdLintResult = {
      lintResult: [],
      diagnostics: [],
      fixedResult: null,
      fixableErrorCount: 1,
      fixableWarningCount: 2,
      executionErrors: [],
    };

    expect(toBatchLintItem("doc.md", result)).toEqual({
      path: "doc.md",
      lintResult: [],
      fixedResult: null,
      fixableErrorCount: 1,
      fixableWarningCount: 2,
      executionErrors: [],
    });
  });

  test("adapts a fix result", () => {
    const fixedResult = {
      result: "# Fixed\n",
      notAppliedFixes: [],
    };
    const result: LintMdFixResult = {
      lintResult: [],
      diagnostics: [],
      fixedResult,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      executionErrors: [],
    };

    expect(toBatchLintItem("doc.md", result)).toEqual({
      path: "doc.md",
      lintResult: [],
      fixedResult,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      executionErrors: [],
    });
  });
});

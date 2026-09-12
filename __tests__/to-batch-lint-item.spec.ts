import type { LintMdFixResult, LintMdLintResult } from "@lint-md/core";
import { toBatchLintItem } from "../src/utils/to-batch-lint-item";
import { summarizeLintResults } from "../src/utils/summarize-lint-results";

describe("toBatchLintItem", () => {
  test("adapts a lint result", () => {
    const result: LintMdLintResult = {
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 1,
        fixableWarningCount: 2,
      },
      fixedResult: null,
      executionErrors: [],
    };

    expect(toBatchLintItem("doc.md", result)).toEqual({
      path: "doc.md",
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 1,
        fixableWarningCount: 2,
      },
      fixedResult: null,
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
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      fixedResult,
      executionErrors: [],
    };

    expect(toBatchLintItem("doc.md", result)).toEqual({
      path: "doc.md",
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult,
      executionErrors: [],
    });
  });

  test("uses the canonical diagnostic range instead of the legacy location", () => {
    const result: LintMdLintResult = {
      lintResult: [
        {
          name: "legacy-rule",
          message: "problem",
          content: "problem",
          severity: 2,
          loc: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 2 },
          },
        },
      ],
      diagnostics: [
        {
          ruleId: "canonical-rule",
          message: "problem",
          severity: 2,
          line: 8,
          column: 9,
          range: {
            start: { line: 8, column: 9 },
            end: { line: 8, column: 10 },
          },
        },
      ],
      summary: {
        errorCount: 1,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: null,
      fixableErrorCount: 1,
      fixableWarningCount: 0,
      executionErrors: [],
    };

    const summary = summarizeLintResults([toBatchLintItem("doc.md", result)]);

    expect(summary.files[0].messages).toEqual([
      {
        line: 8,
        column: 9,
        message: "problem",
        ruleId: "canonical-rule",
        severity: 2,
      },
    ]);
  });
});

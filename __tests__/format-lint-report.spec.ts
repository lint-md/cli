import type { LintSummary } from "../src/utils/summarize-lint-results";
import { formatLintReport } from "../src/utils/format-lint-report";

const makeSummary = (overrides: Partial<LintSummary> = {}): LintSummary => ({
  errorCount: 1,
  files: [
    {
      errorCount: 1,
      filePath: "doc.md",
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      messages: [
        {
          column: 1,
          line: 1,
          message: "some problem",
          ruleId: "rule-x",
          severity: 2,
        },
      ],
      warningCount: 0,
    },
  ],
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  warningCount: 0,
  ...overrides,
});

describe("formatLintReport", () => {
  test("formats the problem summary", () => {
    const output = formatLintReport(
      makeSummary({ errorCount: 2, warningCount: 1 })
    );

    expect(output).toContain("3 problems (2 errors, 1 warning)");
  });

  test("shows the fixable summary", () => {
    const output = formatLintReport(
      makeSummary({ fixableErrorCount: 2, fixableWarningCount: 1 })
    );

    expect(output).toContain(
      "2 errors and 1 warning potentially fixable with the `--fix` option."
    );
  });

  test("omits the fixable summary when counts are zero", () => {
    const output = formatLintReport(makeSummary());

    expect(output).not.toContain("potentially fixable");
  });

  test("sanitizes terminal text", () => {
    const summary = makeSummary();
    summary.files[0].filePath = "doc\u0007.md";
    summary.files[0].messages[0].message = "bad\nmessage";
    summary.files[0].messages[0].ruleId = "rule\tid";

    const output = formatLintReport(summary);

    expect(output).toContain("doc^G.md");
    expect(output).toContain("bad^Jmessage");
    expect(output).toContain("rule^Iid");
  });

  test("returns an empty string for a clean summary", () => {
    const output = formatLintReport({
      errorCount: 0,
      files: [],
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      warningCount: 0,
    });

    expect(output).toBe("");
  });
});

import type { LintDiagnostic, LintSummary } from "@lint-md/core";
import type { BatchLintItem } from "../src/types";
import { summarizeLintResults } from "../src/utils/summarize-lint-results";

const makeDiagnostic = (
  severity: number,
  overrides: Partial<LintDiagnostic> = {}
): LintDiagnostic => ({
  ruleId: "rule-x",
  message: "some problem",
  severity,
  line: 1,
  column: 1,
  range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
  ...overrides,
});

const makeSummary = (overrides: Partial<LintSummary> = {}): LintSummary => ({
  errorCount: 0,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  ...overrides,
});

const makeItem = (overrides: Partial<BatchLintItem> = {}): BatchLintItem => ({
  path: "doc.md",
  diagnostics: [],
  summary: makeSummary(),
  ...overrides,
});

describe("summarizeLintResults", () => {
  test("counts errors and warnings separately", () => {
    const summary = summarizeLintResults([
      makeItem({
        diagnostics: [makeDiagnostic(2), makeDiagnostic(2), makeDiagnostic(1)],
        summary: makeSummary({ errorCount: 2, warningCount: 1 }),
      }),
    ]);

    expect(summary.errorCount).toBe(2);
    expect(summary.warningCount).toBe(1);
    expect(summary.files[0].errorCount).toBe(2);
    expect(summary.files[0].warningCount).toBe(1);
  });

  test("aggregates counts across files", () => {
    const summary = summarizeLintResults([
      makeItem({
        path: "a.md",
        diagnostics: [makeDiagnostic(2), makeDiagnostic(1)],
        summary: makeSummary({
          errorCount: 1,
          warningCount: 1,
          fixableErrorCount: 3,
        }),
      }),
      makeItem({
        path: "b.md",
        diagnostics: [makeDiagnostic(2), makeDiagnostic(2), makeDiagnostic(1)],
        summary: makeSummary({
          errorCount: 2,
          warningCount: 1,
          fixableErrorCount: 1,
          fixableWarningCount: 4,
        }),
      }),
    ]);

    expect(summary).toMatchObject({
      errorCount: 3,
      warningCount: 2,
      fixableErrorCount: 4,
      fixableWarningCount: 4,
    });
  });

  test("converts lint messages without terminal formatting", () => {
    const summary = summarizeLintResults([
      makeItem({
        path: "doc\u0007.md",
        diagnostics: [
          makeDiagnostic(2, {
            range: {
              start: { line: 3, column: 5 },
              end: { line: 3, column: 6 },
            },
            message: "bad\nmessage",
            ruleId: "rule\tid",
          }),
        ],
        summary: makeSummary({ errorCount: 1 }),
      }),
    ]);

    expect(summary.files[0]).toMatchObject({
      filePath: "doc\u0007.md",
      messages: [
        {
          column: 5,
          line: 3,
          message: "bad\nmessage",
          ruleId: "rule\tid",
          severity: 2,
        },
      ],
    });
  });

  test("drops files without lint problems", () => {
    const summary = summarizeLintResults([
      makeItem({
        summary: makeSummary({ fixableErrorCount: 3, fixableWarningCount: 4 }),
      }),
    ]);

    expect(summary).toEqual({
      errorCount: 0,
      files: [],
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      warningCount: 0,
    });
  });
});

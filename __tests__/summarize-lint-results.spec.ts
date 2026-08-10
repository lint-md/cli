import type { LintReportItem } from "@lint-md/core";
import type { BatchLintItem } from "../src/types";
import { summarizeLintResults } from "../src/utils/summarize-lint-results";

const makeReportItem = (
  severity: number,
  overrides: Partial<LintReportItem> = {}
): LintReportItem => ({
  name: "rule-x",
  message: "some problem",
  content: "x",
  severity,
  loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
  ...overrides,
});

const makeItem = (overrides: Partial<BatchLintItem> = {}): BatchLintItem => ({
  path: "doc.md",
  lintResult: [],
  ...overrides,
});

describe("summarizeLintResults", () => {
  test("counts errors and warnings separately", () => {
    const summary = summarizeLintResults([
      makeItem({
        lintResult: [makeReportItem(2), makeReportItem(2), makeReportItem(1)],
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
        lintResult: [makeReportItem(2), makeReportItem(1)],
        fixableErrorCount: 3,
      }),
      makeItem({
        path: "b.md",
        lintResult: [makeReportItem(2), makeReportItem(2), makeReportItem(1)],
        fixableErrorCount: 1,
        fixableWarningCount: 4,
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
        lintResult: [
          makeReportItem(2, {
            loc: {
              start: { line: 3, column: 5 },
              end: { line: 3, column: 6 },
            },
            message: "bad\nmessage",
            name: "rule\tid",
          }),
        ],
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
        fixableErrorCount: 3,
        fixableWarningCount: 4,
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

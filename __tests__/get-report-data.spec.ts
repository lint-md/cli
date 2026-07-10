import type { BatchLintItem } from "../src/types";
import type { LintReportItem } from "@lint-md/core";
import { getReportData } from "../src/utils/get-report-data";

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

describe("getReportData", () => {
  test("counts errors (severity 2) and warnings (severity 1) separately", () => {
    const result = getReportData([
      makeItem({
        lintResult: [makeReportItem(2), makeReportItem(2), makeReportItem(1)],
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      }),
    ]);

    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(1);
  });

  test("aggregates error/warning counts across multiple files", () => {
    const result = getReportData([
      makeItem({
        path: "a.md",
        lintResult: [makeReportItem(2), makeReportItem(1)],
      }),
      makeItem({
        path: "b.md",
        lintResult: [makeReportItem(2), makeReportItem(2), makeReportItem(1)],
      }),
    ]);

    expect(result.errorCount).toBe(3);
    expect(result.warningCount).toBe(2);
  });

  test("shows the fixable summary when fixable counts are present", () => {
    const { consoleMessage } = getReportData([
      makeItem({
        lintResult: [makeReportItem(2), makeReportItem(1)],
        fixableErrorCount: 2,
        fixableWarningCount: 1,
      }),
    ]);

    expect(consoleMessage).toContain(
      "2 errors and 1 warning potentially fixable with the `--fix` option."
    );
  });

  test("omits the fixable summary when fixable counts are zero", () => {
    const { consoleMessage } = getReportData([
      makeItem({
        lintResult: [makeReportItem(2), makeReportItem(1)],
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      }),
    ]);

    expect(consoleMessage).not.toContain(
      "potentially fixable with the `--fix` option."
    );
  });

  test("propagates real fixable counts through aggregation", () => {
    const { consoleMessage } = getReportData([
      makeItem({
        lintResult: [makeReportItem(2)],
        fixableErrorCount: 3,
        fixableWarningCount: 0,
      }),
      makeItem({
        lintResult: [makeReportItem(1)],
        fixableErrorCount: 1,
        fixableWarningCount: 4,
      }),
    ]);

    expect(consoleMessage).toContain(
      "4 errors and 4 warnings potentially fixable with the `--fix` option."
    );
  });

  test("drops files with no problems from the report", () => {
    const { errorCount, warningCount, consoleMessage } = getReportData([
      makeItem({
        lintResult: [],
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      }),
    ]);

    expect(errorCount).toBe(0);
    expect(warningCount).toBe(0);
    expect(consoleMessage).toBe("");
  });
});

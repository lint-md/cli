import { jest } from "@jest/globals";

jest.mock("@lint-md/core", () => ({
  fixMarkdown: jest.fn(),
  lintMarkdown: jest.fn(),
  FixConvergence: {
    STABLE: "stable",
    CYCLE_DETECTED: "cycle",
    MAX_ROUNDS: "max",
  },
}));

import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import lintWorker from "../src/utils/lint-worker";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

const mockedLintMarkdown = lintMarkdown as jest.MockedFunction<
  typeof lintMarkdown
>;
const mockedFixMarkdown = fixMarkdown as jest.MockedFunction<
  typeof fixMarkdown
>;

describe("lintWorker executionErrors passthrough", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "lint-worker-exec-"));
    mockedFixMarkdown.mockReset();
    mockedLintMarkdown.mockReset();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("passes executionErrors from core through to the result", async () => {
    const file = path.join(tmpDir, "doc.md");
    await writeFile(file, "# Title\n", "utf8");

    const executionErrors = [
      {
        ruleName: "no-empty-list",
        message: "rule threw",
        round: 2,
        phase: "fix" as const,
        nodeType: "listItem",
      },
    ];

    mockedLintMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: null,
      executionErrors,
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: false,
    });

    expect(result.executionErrors).toBe(executionErrors);
  });

  test("keeps executionErrors undefined when core returns none", async () => {
    const file = path.join(tmpDir, "clean.md");
    await writeFile(file, "# Clean\n", "utf8");

    mockedLintMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: null,
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: false,
    });

    expect(result.executionErrors).toBeUndefined();
  });

  test("uses fixMarkdown for fix mode", async () => {
    const file = path.join(tmpDir, "fix.md");
    const rules = { "space-around-link": 2 };
    await writeFile(file, "甲[链接](https://example.com)乙\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: { result: "甲 [链接](https://example.com) 乙\n" },
      executionErrors: [],
    } as any);

    await lintWorker({ filePath: file, rules, isFixMode: true });

    expect(mockedFixMarkdown).toHaveBeenCalledWith(
      "甲[链接](https://example.com)乙\n",
      { rules }
    );
    expect(mockedLintMarkdown).not.toHaveBeenCalled();
  });

  test("returns compact fixedResult for clean fix items", async () => {
    const file = path.join(tmpDir, "clean-fix.md");
    await writeFile(file, "# Clean\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: {
        result: "# Clean\n",
        notAppliedFixes: [],
        convergence: "stable",
        metrics: { rounds: 1, wallTime: 0.5, perRound: [0.5] },
      },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    // Compact form: convergence and metrics preserved, result and notAppliedFixes dropped
    expect(result.fixedResult).toEqual({
      convergence: "stable",
      metrics: { rounds: 1, wallTime: 0.5, perRound: [0.5] },
    });
    expect(result.fixedResult).not.toHaveProperty("result");
    expect(result.fixedResult).not.toHaveProperty("notAppliedFixes");
  });

  test("returns full fixedResult for actionable fix items (diagnostics)", async () => {
    const file = path.join(tmpDir, "actionable-fix.md");
    await writeFile(file, "1. hello\n2.\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [
        {
          ruleId: "no-empty-list",
          message: "empty list item",
          line: 2,
          column: 1,
          severity: 2,
        },
      ],
      summary: {
        errorCount: 1,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: {
        result: "1. hello\n2. item\n",
        notAppliedFixes: [],
        convergence: "stable",
      },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    // Full form preserved because item has diagnostics
    expect(result.fixedResult).toHaveProperty("result", "1. hello\n2. item\n");
    expect(result.fixedResult).toHaveProperty("notAppliedFixes");
  });

  test("returns full fixedResult when convergence is cycle", async () => {
    const file = path.join(tmpDir, "cycle-fix.md");
    await writeFile(file, "# Title\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: {
        result: "# Title\n",
        notAppliedFixes: [],
        convergence: "cycle",
        metrics: { rounds: 5, wallTime: 1.0, perRound: [0.2, 0.2, 0.2, 0.2, 0.2] },
      },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    // Full form preserved because isIncompleteFix(item) is true
    expect(result.fixedResult).toHaveProperty("result", "# Title\n");
    expect(result.fixedResult).toHaveProperty("notAppliedFixes");
  });

  test("returns full fixedResult when notAppliedFixes is non-empty", async () => {
    const file = path.join(tmpDir, "unapplied-fix.md");
    await writeFile(file, "# Title\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: {
        result: "# Title\n",
        notAppliedFixes: [
          { targetRule: "r", range: [0, 1], text: "x", reason: "overlap" },
        ],
        convergence: "stable",
      },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    // Full form preserved because notAppliedFixes is non-empty
    expect(result.fixedResult).toHaveProperty("result", "# Title\n");
    expect(result.fixedResult).toHaveProperty("notAppliedFixes");
  });
});

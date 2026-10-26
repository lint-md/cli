import { jest } from "@jest/globals";

jest.mock("@lint-md/core", () => ({
  fixMarkdown: jest.fn(),
  lintMarkdown: jest.fn(),
}));
jest.mock("@lint-md/core/mdx", () => ({
  fixMdx: jest.fn(),
  lintMdx: jest.fn(),
}));

import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import { fixMdx, lintMdx } from "@lint-md/core/mdx";
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
const mockedLintMdx = lintMdx as jest.MockedFunction<typeof lintMdx>;
const mockedFixMdx = fixMdx as jest.MockedFunction<typeof fixMdx>;

describe("lintWorker executionErrors passthrough", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "lint-worker-exec-"));
    mockedFixMarkdown.mockReset();
    mockedLintMarkdown.mockReset();
    mockedFixMdx.mockReset();
    mockedLintMdx.mockReset();
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

  test("marks changed when fix mode changes the content", async () => {
    const file = path.join(tmpDir, "changed.md");
    await writeFile(file, "# Old\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      remainingSummary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: { result: "# New\n", notAppliedFixes: [] },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    expect(result.changed).toBe(true);
  });

  test("does not mark changed when fixed content equals the original", async () => {
    const file = path.join(tmpDir, "unchanged.md");
    await writeFile(file, "# Same\n", "utf8");

    mockedFixMarkdown.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      remainingSummary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: { result: "# Same\n", notAppliedFixes: [] },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    expect(result.changed).toBe(false);
  });

  test("uses fixMdx for MDX fix mode", async () => {
    const file = path.join(tmpDir, "fix.mdx");
    const rules = { "space-around-alphabet": 2 };
    const source = "<Card>正文English内容。</Card>\n";
    await writeFile(file, source, "utf8");

    mockedFixMdx.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      remainingSummary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: { result: "<Card>正文 English 内容。</Card>\n" },
      executionErrors: [],
    } as any);

    const result = await lintWorker({ filePath: file, rules, isFixMode: true });

    expect(mockedFixMdx).toHaveBeenCalledWith(source, { rules });
    expect(mockedFixMarkdown).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
  });

  test("does not mark an unchanged MDX fix as changed", async () => {
    const file = path.join(tmpDir, "unchanged.mdx");
    const source = '<Card label="中文English" />\n';
    await writeFile(file, source, "utf8");

    mockedFixMdx.mockReturnValue({
      lintResult: [],
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      remainingSummary: {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
      fixedResult: { result: source },
      executionErrors: [],
    } as any);

    const result = await lintWorker({
      filePath: file,
      rules: {},
      isFixMode: true,
    });

    expect(result.changed).toBe(false);
    expect(mockedFixMarkdown).not.toHaveBeenCalled();
  });

  test("uses lintMdx for MDX lint mode", async () => {
    const file = path.join(tmpDir, "lint.mdx");
    const source = "<Card>正文English内容。</Card>\n";
    await writeFile(file, source, "utf8");

    mockedLintMdx.mockReturnValue({
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

    await lintWorker({ filePath: file, rules: {}, isFixMode: false });

    expect(mockedLintMdx).toHaveBeenCalledWith(source, { rules: {} });
    expect(mockedFixMdx).not.toHaveBeenCalled();
    expect(mockedLintMarkdown).not.toHaveBeenCalled();
  });

  test("does not mark changed outside fix mode", async () => {
    const file = path.join(tmpDir, "lint-only.md");
    await writeFile(file, "# Lint\n", "utf8");

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

    expect(result.changed).toBe(false);
  });
});

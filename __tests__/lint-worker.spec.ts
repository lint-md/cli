import { jest } from "@jest/globals";

jest.mock("@lint-md/core", () => ({
  fixMarkdown: jest.fn(),
  lintMarkdown: jest.fn(),
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
      fixedResult: null,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
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
      fixedResult: null,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
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
      fixedResult: { result: "甲 [链接](https://example.com) 乙\n" },
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      executionErrors: [],
    } as any);

    await lintWorker({ filePath: file, rules, isFixMode: true });

    expect(mockedFixMarkdown).toHaveBeenCalledWith(
      "甲[链接](https://example.com)乙\n",
      { rules }
    );
    expect(mockedLintMarkdown).not.toHaveBeenCalled();
  });
});

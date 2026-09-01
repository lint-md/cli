import { resolveAdaptiveConcurrency } from "../src/utils/adaptive-concurrency";
import { batchLint } from "../src/utils/batch-lint";
import { filterFilesByMaxSize } from "../src/utils/filter-by-max-size";
import { statFiles, type FileStat } from "../src/utils/file-stat";
import { loadMdFiles } from "../src/utils/load-md-files";
import { runTasksWithLimit } from "../src/utils/run-tasks-with-limit";
import { safeWriteFile } from "../src/utils/safe-write-file";
import { runFileLint } from "../src/cli/run-lint";
import type { BatchLintItem } from "../src/types";

jest.mock("../src/utils/batch-lint", () => ({
  batchLint: jest.fn(),
}));
jest.mock("../src/utils/adaptive-concurrency", () => ({
  resolveAdaptiveConcurrency: jest.fn(),
}));
jest.mock("../src/utils/run-tasks-with-limit", () => ({
  runTasksWithLimit: jest.fn(),
}));
jest.mock("../src/utils/filter-by-max-size", () => ({
  filterFilesByMaxSize: jest.fn(),
}));
jest.mock("../src/utils/file-stat", () => ({
  ...jest.requireActual("../src/utils/file-stat"),
  statFiles: jest.fn(),
}));
jest.mock("../src/utils/load-md-files", () => ({
  loadMdFiles: jest.fn(),
}));
jest.mock("../src/utils/safe-write-file", () => ({
  safeWriteFile: jest.fn(),
}));

const mockBatchLint = batchLint as jest.MockedFunction<typeof batchLint>;
const mockFilterFilesByMaxSize = filterFilesByMaxSize as jest.MockedFunction<
  typeof filterFilesByMaxSize
>;
const mockLoadMdFiles = loadMdFiles as jest.MockedFunction<typeof loadMdFiles>;
const mockStatFiles = statFiles as jest.MockedFunction<typeof statFiles>;
const mockResolveAdaptiveConcurrency =
  resolveAdaptiveConcurrency as jest.MockedFunction<
    typeof resolveAdaptiveConcurrency
  >;
const mockRunTasksWithLimit = runTasksWithLimit as jest.MockedFunction<
  typeof runTasksWithLimit
>;
const mockSafeWriteFile = safeWriteFile as jest.MockedFunction<
  typeof safeWriteFile
>;

describe("runFileLint", () => {
  const originalExitCode = process.exitCode;

  const makeOptions = (
    overrides: Partial<Parameters<typeof runFileLint>[0]> = {}
  ): Parameters<typeof runFileLint>[0] => ({
    excludeFiles: ["**/node_modules/**"],
    extensions: [".md"],
    files: ["*.md"],
    isDev: false,
    isFixMode: false,
    maxFileSizeBytes: null,
    rules: {},
    startTime: 100,
    suppressWarnings: false,
    threadCount: 2,
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    process.exitCode = undefined;
    mockLoadMdFiles.mockResolvedValue(["document.md"]);
    mockStatFiles.mockResolvedValue([{ path: "document.md", size: 0 }]);
    mockFilterFilesByMaxSize.mockImplementation((files) => files);
    mockResolveAdaptiveConcurrency.mockResolvedValue({
      concurrency: 1,
      maxFileSize: null,
      requestedConcurrency: 2,
    });
    mockBatchLint.mockResolvedValue({
      allResults: [],
      actionableResults: [],
    });
    mockRunTasksWithLimit.mockImplementation((async (
      tasks: Array<() => Promise<unknown>>
    ) => Promise.all(tasks.map((task) => task()))) as never);
    mockSafeWriteFile.mockResolvedValue();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(Date, "now").mockReturnValue(125);
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  test("returns before file discovery when no patterns are provided", async () => {
    await runFileLint(makeOptions({ files: [] }));

    expect(mockLoadMdFiles).not.toHaveBeenCalled();
  });

  test("reports unmatched patterns and returns success when discovery finds no files", async () => {
    mockLoadMdFiles.mockResolvedValue([]);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    const outcome = await runFileLint(makeOptions({ files: ["docs/*.md"] }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[lint-md] No Markdown files matched: "docs/*.md"'
    );
    expect(outcome).toEqual({ exitCode: 0 });
    expect(mockFilterFilesByMaxSize).not.toHaveBeenCalled();
  });

  test("escapes quotes inside unmatched patterns", async () => {
    mockLoadMdFiles.mockResolvedValue([]);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await runFileLint(makeOptions({ files: ['docs/"draft".md'] }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[lint-md] No Markdown files matched: "docs/\\"draft\\".md"'
    );
  });

  test("reports size filtering when all discovered files are skipped", async () => {
    mockLoadMdFiles.mockResolvedValue(["large.md"]);
    mockStatFiles.mockResolvedValue([{ path: "large.md", size: 200 }]);
    mockFilterFilesByMaxSize.mockReturnValue([]);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    const outcome = await runFileLint(makeOptions({ maxFileSizeBytes: 100 }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[lint-md] No Markdown files remain after file-size filtering."
    );
    expect(outcome).toEqual({ exitCode: 0 });
    expect(mockResolveAdaptiveConcurrency).not.toHaveBeenCalled();
    expect(mockBatchLint).not.toHaveBeenCalled();
  });

  test("filters files before concurrency and batch decisions", async () => {
    mockLoadMdFiles.mockResolvedValue(["small.md", "large.md"]);
    const fileStats: FileStat[] = [
      { path: "small.md", size: 50 },
      { path: "large.md", size: 200 },
    ];
    mockStatFiles.mockResolvedValue(fileStats);
    mockFilterFilesByMaxSize.mockReturnValue([fileStats[0]]);

    await runFileLint(makeOptions({ maxFileSizeBytes: 100 }));

    expect(mockStatFiles).toHaveBeenCalledWith(["small.md", "large.md"]);
    expect(mockFilterFilesByMaxSize).toHaveBeenCalledWith(fileStats, 100);
    expect(mockResolveAdaptiveConcurrency).toHaveBeenCalledWith(
      2,
      ["small.md"],
      50
    );
    expect(mockBatchLint).toHaveBeenCalledWith(1, ["small.md"], false, {});
    expect(mockFilterFilesByMaxSize.mock.invocationCallOrder[0]).toBeLessThan(
      mockResolveAdaptiveConcurrency.mock.invocationCallOrder[0]
    );
  });

  test("returns success and reports timing after a clean lint", async () => {
    const outcome = await runFileLint(makeOptions());

    expect(mockStatFiles).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("");
    expect(console.log).toHaveBeenCalledWith("⌛️Done in 25ms.");
    expect(outcome).toEqual({ exitCode: 0 });
  });

  test("reports rule failures to stderr and returns failure without timing", async () => {
    const failedResult: BatchLintItem = {
      path: "failed.md",
      lintResult: [],
      executionErrors: [
        {
          ruleName: "broken-rule",
          message: "rule threw",
          round: 1,
          phase: "selector",
        },
      ],
    };
    mockBatchLint.mockResolvedValue({
      allResults: [failedResult],
      actionableResults: [failedResult],
    });
    const stderr = jest.spyOn(console, "error").mockImplementation();
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    const outcome = await runFileLint(makeOptions({ suppressWarnings: true }));

    expect(console.log).toHaveBeenCalledWith("");
    expect(stderr).toHaveBeenCalledWith(
      "[lint-md] failed.md: broken-rule failed in selector (round 1): rule threw"
    );
    expect((console.log as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      stderr.mock.invocationCallOrder[0]
    );
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining("Done in")
    );
    expect(exit).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(outcome).toEqual({ exitCode: 1 });
  });

  test("writes actionable fixes and reports metrics for all results", async () => {
    const cleanResult: BatchLintItem = {
      path: "clean.md",
      lintResult: [],
      fixedResult: { result: "clean", notAppliedFixes: [] },
    };
    const actionableResult: BatchLintItem = {
      path: "actionable.md",
      lintResult: [],
      fixedResult: { result: "fixed", notAppliedFixes: [] },
    };
    const allResults = [cleanResult, actionableResult];
    const actionableResults = [actionableResult];
    mockBatchLint.mockResolvedValue({ allResults, actionableResults });
    const reportModule = require("../src/utils/report-incomplete-fixes");
    const metrics = jest
      .spyOn(reportModule, "getFixDevMetrics")
      .mockReturnValue(["fix metrics"]);

    await runFileLint(makeOptions({ isDev: true, isFixMode: true }));

    expect(mockSafeWriteFile).toHaveBeenCalledTimes(1);
    expect(mockSafeWriteFile).toHaveBeenCalledWith("actionable.md", "fixed");
    expect(metrics).toHaveBeenCalledWith(allResults);
    expect(console.log).toHaveBeenCalledWith("fix metrics");
  });
});

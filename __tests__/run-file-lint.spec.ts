import {
  batchLint,
  resolveAdaptiveConcurrency,
  runTasksWithLimit,
} from "../src/utils/batch-lint";
import { filterFilesByMaxSize } from "../src/utils/filter-by-max-size";
import { loadMdFiles } from "../src/utils/load-md-files";
import { safeWriteFile } from "../src/utils/safe-write-file";
import { runFileLint } from "../src/cli/run-lint";
import type { BatchLintItem } from "../src/types";

jest.mock("../src/utils/batch-lint", () => ({
  batchLint: jest.fn(),
  resolveAdaptiveConcurrency: jest.fn(),
  runTasksWithLimit: jest.fn(),
}));
jest.mock("../src/utils/filter-by-max-size", () => ({
  filterFilesByMaxSize: jest.fn(),
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
    mockLoadMdFiles.mockResolvedValue(["document.md"]);
    mockFilterFilesByMaxSize.mockImplementation(async (files) => files);
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
    jest.restoreAllMocks();
  });

  test("returns before file discovery when no patterns are provided", async () => {
    await runFileLint(makeOptions({ files: [] }));

    expect(mockLoadMdFiles).not.toHaveBeenCalled();
  });

  test("exits successfully when file discovery returns no matches", async () => {
    mockLoadMdFiles.mockResolvedValue([]);
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    await expect(runFileLint(makeOptions())).rejects.toThrow("process.exit");

    expect(console.log).toHaveBeenCalledWith("🎉 No markdown files to lint 🎉");
    expect(exit).toHaveBeenCalledWith(0);
  });

  test("filters files before concurrency and batch decisions", async () => {
    mockLoadMdFiles.mockResolvedValue(["small.md", "large.md"]);
    mockFilterFilesByMaxSize.mockResolvedValue(["small.md"]);

    await runFileLint(makeOptions({ maxFileSizeBytes: 100 }));

    expect(mockFilterFilesByMaxSize).toHaveBeenCalledWith(
      ["small.md", "large.md"],
      100
    );
    expect(mockResolveAdaptiveConcurrency).toHaveBeenCalledWith(2, [
      "small.md",
    ]);
    expect(mockBatchLint).toHaveBeenCalledWith(1, ["small.md"], false, {});
    expect(mockFilterFilesByMaxSize.mock.invocationCallOrder[0]).toBeLessThan(
      mockResolveAdaptiveConcurrency.mock.invocationCallOrder[0]
    );
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

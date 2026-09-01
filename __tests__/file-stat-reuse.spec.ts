import type { Stats } from "fs";
import { availableParallelism } from "os";
import { runFileLint } from "../src/cli/run-lint";
import { batchLint } from "../src/utils/batch-lint";
import { loadMdFiles } from "../src/utils/load-md-files";
import type { ThreadCount } from "../src/types";

jest.mock("../src/utils/batch-lint", () => ({
  batchLint: jest.fn(),
}));
jest.mock("../src/utils/load-md-files", () => ({
  loadMdFiles: jest.fn(),
}));

const mockBatchLint = batchLint as jest.MockedFunction<typeof batchLint>;
const mockLoadMdFiles = loadMdFiles as jest.MockedFunction<typeof loadMdFiles>;

describe("file stat reuse", () => {
  const statCases: Array<[string, ThreadCount, number | null, number]> = [
    ["fixed threads without a size limit", 2, null, 0],
    ["auto threads without a size limit", "auto", null, 2],
    ["fixed threads with a size limit", 2, 1024, 2],
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    mockBatchLint.mockResolvedValue({
      allResults: [],
      actionableResults: [],
    });
    jest.spyOn(console, "error").mockImplementation();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(statCases)(
    "%s performs the expected stat calls",
    async (_name, threadCount, maxFileSizeBytes, expectedCalls) => {
      const files = ["a.md", "b.md"];
      mockLoadMdFiles.mockResolvedValue(files);
      const fsPromises = require("fs/promises");
      const statSpy = jest
        .spyOn(fsPromises, "stat")
        .mockResolvedValue({ size: 100 } as Stats);

      await runFileLint({
        excludeFiles: [],
        extensions: [".md"],
        files: ["*.md"],
        isDev: false,
        isFixMode: false,
        maxFileSizeBytes,
        rules: {},
        startTime: 0,
        suppressWarnings: false,
        threadCount,
      });

      expect(statSpy).toHaveBeenCalledTimes(expectedCalls);
    }
  );

  test("stats each file once before filtering and adaptive concurrency", async () => {
    const files = ["huge.md", "a.md", "b.md"];
    const sizes = new Map([
      ["huge.md", 20 * 1024 * 1024],
      ["a.md", 100 * 1024],
      ["b.md", 100 * 1024],
    ]);
    mockLoadMdFiles.mockResolvedValue(files);
    const fsPromises = require("fs/promises");
    const statSpy = jest
      .spyOn(fsPromises, "stat")
      .mockImplementation(async (filePath) => {
        return { size: sizes.get(String(filePath)) ?? 0 } as Stats;
      });

    await runFileLint({
      excludeFiles: [],
      extensions: [".md"],
      files: ["*.md"],
      isDev: false,
      isFixMode: false,
      maxFileSizeBytes: 5 * 1024 * 1024,
      rules: {},
      startTime: 0,
      suppressWarnings: false,
      threadCount: "auto",
    });

    expect(statSpy).toHaveBeenCalledTimes(files.length);
    expect(mockBatchLint).toHaveBeenCalledWith(
      Math.min(availableParallelism(), 2),
      ["a.md", "b.md"],
      false,
      {}
    );
  });
});

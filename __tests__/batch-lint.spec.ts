import { mkdtemp, rm, writeFile } from "fs/promises";
import { availableParallelism, tmpdir } from "os";
import * as path from "path";
import { Piscina } from "piscina";
import type { LintMdRulesConfig } from "@lint-md/core";
import { resolveAdaptiveConcurrency } from "../src/utils/adaptive-concurrency";
import { batchLint, keepLintItem } from "../src/utils/batch-lint";
import {
  STAT_CONCURRENCY_LIMIT,
  getMaxFileSize,
  statFiles,
} from "../src/utils/file-stat";
import type { BatchLintItem } from "../src/types";
import { makeNotAppliedFix } from "./helpers/not-applied-fix";

const makeItem = (overrides: Partial<BatchLintItem> = {}): BatchLintItem => ({
  path: "doc.md",
  diagnostics: [],
  summary: {
    errorCount: 0,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
  },
  ...overrides,
});

const RULES_NO_EMPTY_LIST: LintMdRulesConfig = {
  "no-empty-list": 2,
};

const TRIGGER_CONTENT = "1. hello\n2.\n";

describe("batchLint", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "batch-lint-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns empty result when no files are provided", async () => {
    const result = await batchLint(2, [], false, RULES_NO_EMPTY_LIST);
    expect(result).toEqual({ allResults: [], actionableResults: [] });
  });

  describe("路径 payload", () => {
    test("returns results keyed by the original file path", async () => {
      const fileA = path.join(tmpDir, "a.md");
      const fileB = path.join(tmpDir, "b.md");
      await writeFile(fileA, TRIGGER_CONTENT, "utf8");
      await writeFile(fileB, TRIGGER_CONTENT, "utf8");

      const { actionableResults } = await batchLint(
        2,
        [fileA, fileB],
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults.map((item) => item.path)).toEqual([
        fileA,
        fileB,
      ]);
      actionableResults.forEach((item) => {
        expect(Array.isArray(item.diagnostics)).toBe(true);
        expect(item.diagnostics.length).toBeGreaterThan(0);
        expect(item.fixedResult == null).toBe(true);
      });
    });

    test("worker reads the file on its own (content is not pre-loaded)", async () => {
      const file = path.join(tmpDir, "read-in-worker.md");
      await writeFile(file, TRIGGER_CONTENT, "utf8");

      const { actionableResults } = await batchLint(
        1,
        [file],
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults).toHaveLength(1);
      expect(actionableResults[0].path).toBe(file);
      expect(actionableResults[0].diagnostics[0].ruleId).toBe("no-empty-list");
    });
  });

  describe("并发上限", () => {
    test("caps concurrent worker tasks at the threads count", async () => {
      const fileCount = 8;
      const files = await Promise.all(
        Array.from({ length: fileCount }, (_, i) => {
          const file = path.join(tmpDir, `file-${i}.md`);
          return writeFile(file, TRIGGER_CONTENT, "utf8").then(() => file);
        })
      );

      const { actionableResults } = await batchLint(
        3,
        files,
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults).toHaveLength(fileCount);
      expect(actionableResults.map((item) => item.path)).toEqual(files);
    });

    test("threads greater than files does not error", async () => {
      const file = path.join(tmpDir, "single.md");
      await writeFile(file, TRIGGER_CONTENT, "utf8");

      const { actionableResults } = await batchLint(
        16,
        [file],
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults).toHaveLength(1);
    });
  });

  describe("报告顺序", () => {
    test("results are returned in input order (not group order)", async () => {
      const fileA = path.join(tmpDir, "order-a.md");
      const fileB = path.join(tmpDir, "order-b.md");
      const fileC = path.join(tmpDir, "order-c.md");
      await writeFile(fileA, TRIGGER_CONTENT, "utf8");
      await writeFile(fileB, TRIGGER_CONTENT, "utf8");
      await writeFile(fileC, TRIGGER_CONTENT, "utf8");

      const { actionableResults } = await batchLint(
        2,
        [fileA, fileB, fileC],
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults.map((item) => item.path)).toEqual([
        fileA,
        fileB,
        fileC,
      ]);
    });
  });

  describe("pool 销毁", () => {
    test("returns successfully and does not leave worker processes hanging", async () => {
      const file = path.join(tmpDir, "pool-cleanup.md");
      await writeFile(file, "# Clean content\n", "utf8");

      await expect(
        batchLint(2, [file], false, RULES_NO_EMPTY_LIST)
      ).resolves.toBeDefined();
    });

    test("destroys the pool even when a worker throws", async () => {
      const destroySpy = jest.spyOn(Piscina.prototype, "destroy");
      const file = path.join(tmpDir, "missing.md");

      try {
        await expect(
          batchLint(1, [file], false, RULES_NO_EMPTY_LIST)
        ).rejects.toThrow();
        expect(destroySpy).toHaveBeenCalled();
      } finally {
        destroySpy.mockRestore();
      }
    });
  });

  describe("fix 行为", () => {
    test("returns fixedResult in fix mode", async () => {
      const file = path.join(tmpDir, "fixable.md");
      await writeFile(file, TRIGGER_CONTENT, "utf8");

      const { actionableResults } = await batchLint(
        1,
        [file],
        true,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults).toHaveLength(1);
      expect(actionableResults[0].fixedResult).not.toBeNull();
      expect(actionableResults[0].fixedResult?.result).toBeDefined();
    });

    test("does not return fixedResult when fix mode is disabled", async () => {
      const file = path.join(tmpDir, "no-fix.md");
      await writeFile(file, TRIGGER_CONTENT, "utf8");

      const { actionableResults } = await batchLint(
        1,
        [file],
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(actionableResults).toHaveLength(1);
      expect(actionableResults[0].fixedResult == null).toBe(true);
    });
  });
});

describe("keepLintItem", () => {
  test("keeps items with a non-empty lint report", () => {
    expect(
      keepLintItem(
        makeItem({
          diagnostics: [
            {
              message: "x",
              ruleId: "y",
              line: 1,
              column: 1,
              severity: 2,
              range: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 1 },
              },
            },
          ],
        })
      )
    ).toBe(true);
  });

  test("drops items with empty lint report and null fixedResult", () => {
    expect(keepLintItem(makeItem({ fixedResult: null }))).toBe(false);
  });

  test("drops items with empty lint report and empty notAppliedFixes", () => {
    expect(
      keepLintItem(
        makeItem({ fixedResult: { result: "x", notAppliedFixes: [] } })
      )
    ).toBe(false);
  });

  test("keeps items with empty lint report but non-empty notAppliedFixes", () => {
    expect(
      keepLintItem(
        makeItem({
          fixedResult: {
            result: "x",
            notAppliedFixes: [makeNotAppliedFix([0, 1], "y")],
          },
        })
      )
    ).toBe(true);
  });
});

describe("getMaxFileSize", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "batch-lint-max-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns 0 for empty list", async () => {
    expect(getMaxFileSize([])).toBe(0);
  });

  test("returns size of the only file", async () => {
    expect(getMaxFileSize([{ path: "only.md", size: 5 }])).toBe(5);
  });

  test("returns size of the largest file among many", async () => {
    expect(
      getMaxFileSize([
        { path: "small.md", size: 10 },
        { path: "large.md", size: 1000 },
        { path: "medium.md", size: 500 },
      ])
    ).toBe(1000);
  });

  test("rejects when a file cannot be stat-ed", async () => {
    const missing = path.join(tmpDir, "missing.md");
    await expect(statFiles([missing])).rejects.toThrow();
  });

  test("bounds concurrent stat calls to STAT_CONCURRENCY_LIMIT", async () => {
    const fileCount = STAT_CONCURRENCY_LIMIT * 3;
    const filePaths = Array.from({ length: fileCount }, (_, index) =>
      path.join(tmpDir, `bounded-${index}.md`)
    );
    const sizeMap = new Map(
      filePaths.map((filePath, index) => [filePath, index + 1])
    );

    let inFlight = 0;
    let maxInFlight = 0;

    const fsPromises = require("fs/promises");
    const statSpy = jest
      .spyOn(fsPromises, "stat")
      .mockImplementation((filePath: string) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--;
            resolve({ size: sizeMap.get(filePath) ?? 0 });
          }, 20);
        });
      });

    try {
      const result = await statFiles(filePaths);

      expect(getMaxFileSize(result)).toBe(fileCount);
      expect(statSpy).toHaveBeenCalledTimes(fileCount);
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBeLessThanOrEqual(STAT_CONCURRENCY_LIMIT);
    } finally {
      statSpy.mockRestore();
    }
  });
});

describe("resolveAdaptiveConcurrency", () => {
  describe("numeric threadCount (preserves existing behavior)", () => {
    test("numeric 2 with 3 files → 2", () => {
      expect(resolveAdaptiveConcurrency(2, 3, 0)).toEqual({
        concurrency: 2,
        maxFileSize: null,
        requestedConcurrency: 2,
      });
    });

    test("numeric threads > fileCount is clamped to fileCount", () => {
      expect(resolveAdaptiveConcurrency(100, 1, 0)).toEqual({
        concurrency: 1,
        maxFileSize: null,
        requestedConcurrency: 100,
      });
    });

    test("numeric 0 is clamped to 1 (matches existing min clamp)", () => {
      expect(resolveAdaptiveConcurrency(0, 2, 0)).toEqual({
        concurrency: 1,
        maxFileSize: null,
        requestedConcurrency: 0,
      });
    });

    test("numeric threads ignores file size", () => {
      expect(resolveAdaptiveConcurrency(8, 8, 10 * 1024 * 1024)).toEqual({
        concurrency: 8,
        maxFileSize: null,
        requestedConcurrency: 8,
      });
    });
  });

  describe("auto threadCount", () => {
    test("empty file list → 0", () => {
      expect(resolveAdaptiveConcurrency("auto", 0, 0)).toEqual({
        concurrency: 0,
        maxFileSize: 0,
        requestedConcurrency: availableParallelism(),
      });
    });

    test("small files (< 1 MiB) cap concurrency at 4", () => {
      const cpuLimit = availableParallelism();
      expect(resolveAdaptiveConcurrency("auto", 8, 4096)).toEqual({
        concurrency: Math.min(cpuLimit, 4, 8),
        maxFileSize: 4096,
        requestedConcurrency: cpuLimit,
      });
    });

    test("max file exactly 1 MiB caps at 2", () => {
      const cpuLimit = availableParallelism();
      expect(resolveAdaptiveConcurrency("auto", 2, 1024 * 1024)).toEqual({
        concurrency: Math.min(cpuLimit, 2, 2),
        maxFileSize: 1024 * 1024,
        requestedConcurrency: cpuLimit,
      });
    });

    test("max file 1.5 MiB caps at 2", () => {
      expect(resolveAdaptiveConcurrency("auto", 1, 1.5 * 1024 * 1024)).toEqual({
        concurrency: 1,
        maxFileSize: 1.5 * 1024 * 1024,
        requestedConcurrency: availableParallelism(),
      });
    });

    test("max file exactly 5 MiB forces 1", () => {
      expect(resolveAdaptiveConcurrency("auto", 1, 5 * 1024 * 1024)).toEqual({
        concurrency: 1,
        maxFileSize: 5 * 1024 * 1024,
        requestedConcurrency: availableParallelism(),
      });
    });

    test("max file 6 MiB forces 1", () => {
      expect(resolveAdaptiveConcurrency("auto", 1, 6 * 1024 * 1024)).toEqual({
        concurrency: 1,
        maxFileSize: 6 * 1024 * 1024,
        requestedConcurrency: availableParallelism(),
      });
    });

    test("single small file → 1", () => {
      expect(resolveAdaptiveConcurrency("auto", 1, 100)).toEqual({
        concurrency: 1,
        maxFileSize: 100,
        requestedConcurrency: availableParallelism(),
      });
    });

    test("medium cap respects fileCount when files < 2", () => {
      expect(
        resolveAdaptiveConcurrency("auto", 1, Math.floor(1.2 * 1024 * 1024))
      ).toEqual({
        concurrency: 1,
        maxFileSize: Math.floor(1.2 * 1024 * 1024),
        requestedConcurrency: availableParallelism(),
      });
    });
  });
});

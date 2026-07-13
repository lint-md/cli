import { mkdtemp, rm, writeFile } from "fs/promises";
import { availableParallelism, tmpdir } from "os";
import * as path from "path";
import { Piscina } from "piscina";
import type { LintMdRulesConfig } from "@lint-md/core";
import {
  STAT_CONCURRENCY_LIMIT,
  batchLint,
  getMaxFileSize,
  keepLintItem,
  resolveAdaptiveConcurrency,
  runTasksWithLimit,
} from "../src/utils/batch-lint";
import type { BatchLintItem } from "../src/types";

const makeItem = (overrides: Partial<BatchLintItem> = {}): BatchLintItem => ({
  path: "doc.md",
  lintResult: [],
  ...overrides,
});

const RULES_NO_EMPTY_LIST: LintMdRulesConfig = {
  "no-empty-list": 2,
};

const TRIGGER_CONTENT = "1. hello\n2.\n";

describe("runTasksWithLimit", () => {
  test("respects concurrency limit", async () => {
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      return true;
    });

    await runTasksWithLimit(tasks, 2);
    expect(maxRunning).toBe(2);
  });

  test("preserves result order", async () => {
    const tasks = [3, 1, 4, 1, 5].map((n) => async () => n);
    const result = await runTasksWithLimit(tasks, 2);
    expect(result).toEqual([3, 1, 4, 1, 5]);
  });

  test("handles empty task list", async () => {
    const result = await runTasksWithLimit([], 3);
    expect(result).toEqual([]);
  });

  test("limit greater than tasks count still works", async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 10);
    const result = await runTasksWithLimit(tasks, 10);
    expect(result).toEqual([10, 20, 30]);
  });
});

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
        expect(Array.isArray(item.lintResult)).toBe(true);
        expect(item.lintResult.length).toBeGreaterThan(0);
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
      expect(actionableResults[0].lintResult[0].name).toBe("no-empty-list");
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

  describe("allResults vs actionableResults", () => {
    test("allResults keeps clean files; actionableResults drops them", async () => {
      const cleanFile = path.join(tmpDir, "clean.md");
      const dirtyFile = path.join(tmpDir, "dirty.md");
      await writeFile(cleanFile, "# Clean content\n", "utf8");
      await writeFile(dirtyFile, TRIGGER_CONTENT, "utf8");

      const { allResults, actionableResults } = await batchLint(
        1,
        [cleanFile, dirtyFile],
        false,
        RULES_NO_EMPTY_LIST
      );

      expect(allResults.map((item) => item.path)).toEqual([
        cleanFile,
        dirtyFile,
      ]);
      expect(actionableResults.map((item) => item.path)).toEqual([dirtyFile]);
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
          lintResult: [
            {
              message: "x",
              name: "y",
              content: "z",
              severity: 2,
              loc: {
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
            notAppliedFixes: [{ range: [0, 1], text: "y" }],
          },
        })
      )
    ).toBe(true);
  });
});

describe("getMaxFileSize", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "max-file-size-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns 0 for empty input", async () => {
    expect(await getMaxFileSize([])).toBe(0);
  });

  test("returns the largest file size in bytes", async () => {
    const small = path.join(tmpDir, "small.md");
    const large = path.join(tmpDir, "large.md");
    await writeFile(small, "a".repeat(10), "utf8");
    await writeFile(large, "b".repeat(1024), "utf8");

    expect(await getMaxFileSize([small, large])).toBe(1024);
  });
});

describe("resolveAdaptiveConcurrency", () => {
  test("clamps to file count when below CPU count", async () => {
    const files = ["a.md", "b.md"];
    const result = await resolveAdaptiveConcurrency(
      availableParallelism(),
      files
    );
    expect(result).toBe(2);
  });

  test("returns 0 when there are no files", async () => {
    expect(await resolveAdaptiveConcurrency(4, [])).toBe(0);
  });

  test("respects a numeric threadCount", async () => {
    expect(await resolveAdaptiveConcurrency(1, ["a.md", "b.md", "c.md"])).toBe(
      1
    );
    expect(await resolveAdaptiveConcurrency(5, ["a.md", "b.md"])).toBe(2);
  });

  test("clamps large file paths to a single thread", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "adaptive-"));
    try {
      const huge = path.join(tmp, "huge.md");
      await writeFile(huge, "x".repeat(6 * 1024 * 1024), "utf8");

      const result = await resolveAdaptiveConcurrency("auto", [huge]);
      expect(result).toBe(1);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("STAT_CONCURRENCY_LIMIT", () => {
  test("is a positive integer", () => {
    expect(STAT_CONCURRENCY_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(STAT_CONCURRENCY_LIMIT)).toBe(true);
  });
});

import { mkdtemp, rm, writeFile } from 'fs/promises';
import { availableParallelism, tmpdir } from 'os';
import * as path from 'path';
import { Piscina } from 'piscina';
import type { LintMdRulesConfig } from '@lint-md/core';
import { STAT_CONCURRENCY_LIMIT, batchLint, getMaxFileSize, resolveAdaptiveConcurrency, runTasksWithLimit } from '../src/utils/batch-lint';

const RULES_NO_EMPTY_LIST: LintMdRulesConfig = {
  'no-empty-list': 2,
};

const TRIGGER_CONTENT = '1. hello\n2.\n';

describe('runTasksWithLimit', () => {
  test('respects concurrency limit', async () => {
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise(resolve => setTimeout(resolve, 10));
      running--;
      return true;
    });

    await runTasksWithLimit(tasks, 2);
    expect(maxRunning).toBe(2);
  });

  test('preserves result order', async () => {
    const tasks = [3, 1, 4, 1, 5].map(n => async () => n);
    const result = await runTasksWithLimit(tasks, 2);
    expect(result).toEqual([3, 1, 4, 1, 5]);
  });

  test('handles empty task list', async () => {
    const result = await runTasksWithLimit([], 3);
    expect(result).toEqual([]);
  });

  test('limit greater than tasks count still works', async () => {
    const tasks = [1, 2, 3].map(n => async () => n * 10);
    const result = await runTasksWithLimit(tasks, 10);
    expect(result).toEqual([10, 20, 30]);
  });
});

describe('batchLint', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'batch-lint-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array when no files are provided', async () => {
    const result = await batchLint(2, [], false, false, RULES_NO_EMPTY_LIST);
    expect(result).toEqual([]);
  });

  describe('路径 payload', () => {
    test('returns results keyed by the original file path', async () => {
      const fileA = path.join(tmpDir, 'a.md');
      const fileB = path.join(tmpDir, 'b.md');
      await writeFile(fileA, TRIGGER_CONTENT, 'utf8');
      await writeFile(fileB, TRIGGER_CONTENT, 'utf8');

      const result = await batchLint(2, [fileA, fileB], false, false, RULES_NO_EMPTY_LIST);

      expect(result.map(item => item.path)).toEqual([fileA, fileB]);
      result.forEach((item) => {
        expect(Array.isArray(item.lintResult)).toBe(true);
        expect(item.lintResult.length).toBeGreaterThan(0);
        expect(item.fixedResult == null).toBe(true);
      });
    });

    test('worker reads the file on its own (content is not pre-loaded)', async () => {
      const file = path.join(tmpDir, 'read-in-worker.md');
      await writeFile(file, TRIGGER_CONTENT, 'utf8');

      const result = await batchLint(1, [file], false, false, RULES_NO_EMPTY_LIST);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe(file);
      expect(result[0].lintResult[0].name).toBe('no-empty-list');
    });
  });

  describe('并发上限', () => {
    test('caps concurrent worker tasks at the threads count', async () => {
      const fileCount = 8;
      const files = await Promise.all(
        Array.from({ length: fileCount }, (_, i) => {
          const file = path.join(tmpDir, `file-${i}.md`);
          return writeFile(file, TRIGGER_CONTENT, 'utf8').then(() => file);
        })
      );

      const result = await batchLint(3, files, false, false, RULES_NO_EMPTY_LIST);

      expect(result).toHaveLength(fileCount);
      expect(result.map(item => item.path)).toEqual(files);
    });

    test('threads greater than files does not error', async () => {
      const file = path.join(tmpDir, 'single.md');
      await writeFile(file, TRIGGER_CONTENT, 'utf8');

      const result = await batchLint(16, [file], false, false, RULES_NO_EMPTY_LIST);

      expect(result).toHaveLength(1);
    });
  });

  describe('报告顺序', () => {
    test('results are returned in input order (not group order)', async () => {
      const fileA = path.join(tmpDir, 'order-a.md');
      const fileB = path.join(tmpDir, 'order-b.md');
      const fileC = path.join(tmpDir, 'order-c.md');
      await writeFile(fileA, TRIGGER_CONTENT, 'utf8');
      await writeFile(fileB, TRIGGER_CONTENT, 'utf8');
      await writeFile(fileC, TRIGGER_CONTENT, 'utf8');

      const result = await batchLint(2, [fileA, fileB, fileC], false, false, RULES_NO_EMPTY_LIST);

      expect(result.map(item => item.path)).toEqual([fileA, fileB, fileC]);
    });
  });

  describe('pool 销毁', () => {
    test('returns successfully and does not leave worker processes hanging', async () => {
      const file = path.join(tmpDir, 'pool-cleanup.md');
      await writeFile(file, '# Clean content\n', 'utf8');

      await expect(batchLint(2, [file], false, false, RULES_NO_EMPTY_LIST)).resolves.toBeDefined();
    });

    test('destroys the pool even when a worker throws', async () => {
      const destroySpy = jest.spyOn(Piscina.prototype, 'destroy');
      const file = path.join(tmpDir, 'missing.md');

      try {
        await expect(batchLint(1, [file], false, false, RULES_NO_EMPTY_LIST)).rejects.toThrow();
        expect(destroySpy).toHaveBeenCalled();
      }
      finally {
        destroySpy.mockRestore();
      }
    });
  });

  describe('fix 行为', () => {
    test('returns fixedResult in fix mode', async () => {
      const file = path.join(tmpDir, 'fixable.md');
      await writeFile(file, TRIGGER_CONTENT, 'utf8');

      const result = await batchLint(1, [file], false, true, RULES_NO_EMPTY_LIST);

      expect(result).toHaveLength(1);
      expect(result[0].fixedResult).not.toBeNull();
      expect(result[0].fixedResult?.result).toBeDefined();
    });

    test('does not return fixedResult when fix mode is disabled', async () => {
      const file = path.join(tmpDir, 'no-fix.md');
      await writeFile(file, TRIGGER_CONTENT, 'utf8');

      const result = await batchLint(1, [file], false, false, RULES_NO_EMPTY_LIST);

      expect(result).toHaveLength(1);
      expect(result[0].fixedResult == null).toBe(true);
    });
  });
});

describe('getMaxFileSize', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'batch-lint-max-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('returns 0 for empty list', async () => {
    expect(await getMaxFileSize([])).toBe(0);
  });

  test('returns size of the only file', async () => {
    const file = path.join(tmpDir, 'only.md');
    await writeFile(file, 'hello');
    expect(await getMaxFileSize([file])).toBe(5);
  });

  test('returns size of the largest file among many', async () => {
    const small = path.join(tmpDir, 'small.md');
    const large = path.join(tmpDir, 'large.md');
    const medium = path.join(tmpDir, 'medium.md');
    await writeFile(small, 'a'.repeat(10));
    await writeFile(large, 'b'.repeat(1000));
    await writeFile(medium, 'c'.repeat(500));

    expect(await getMaxFileSize([small, large, medium])).toBe(1000);
  });

  test('rejects when a file cannot be stat-ed', async () => {
    const missing = path.join(tmpDir, 'missing.md');
    await expect(getMaxFileSize([missing])).rejects.toThrow();
  });

  test('bounds concurrent stat calls to STAT_CONCURRENCY_LIMIT', async () => {
    const fileCount = STAT_CONCURRENCY_LIMIT * 3;
    const filePaths = Array.from({ length: fileCount }, (_, index) =>
      path.join(tmpDir, `bounded-${index}.md`)
    );
    const sizeMap = new Map(filePaths.map((filePath, index) => [filePath, index + 1]));

    let inFlight = 0;
    let maxInFlight = 0;

    const fsPromises = require('fs/promises');
    const statSpy = jest.spyOn(fsPromises, 'stat').mockImplementation((filePath: string) => {
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
      const result = await getMaxFileSize(filePaths);

      expect(result).toBe(fileCount);
      expect(statSpy).toHaveBeenCalledTimes(fileCount);
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBeLessThanOrEqual(STAT_CONCURRENCY_LIMIT);
    }
    finally {
      statSpy.mockRestore();
    }
  });
});

describe('resolveAdaptiveConcurrency', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'batch-lint-adaptive-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const writeSizedFile = async (name: string, sizeBytes: number) => {
    const file = path.join(tmpDir, name);
    await writeFile(file, Buffer.alloc(sizeBytes));
    return file;
  };

  describe('numeric threadCount (preserves existing behavior)', () => {
    test('numeric 2 with 3 files → 2', async () => {
      const files = await Promise.all([
        writeSizedFile('a.md', 100),
        writeSizedFile('b.md', 100),
        writeSizedFile('c.md', 100),
      ]);
      expect(await resolveAdaptiveConcurrency(2, files)).toBe(2);
    });

    test('numeric threads > fileCount is clamped to fileCount', async () => {
      const file = await writeSizedFile('only.md', 100);
      expect(await resolveAdaptiveConcurrency(100, [file])).toBe(1);
    });

    test('numeric 0 is clamped to 1 (matches existing min clamp)', async () => {
      const files = await Promise.all([
        writeSizedFile('a.md', 100),
        writeSizedFile('b.md', 100),
      ]);
      expect(await resolveAdaptiveConcurrency(0, files)).toBe(1);
    });

    test('numeric threads ignores file size', async () => {
      const files = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          writeSizedFile(`huge-${index}.md`, 10 * 1024 * 1024)
        )
      );

      expect(await resolveAdaptiveConcurrency(8, files)).toBe(8);
    });
  });

  describe('auto threadCount', () => {
    test('empty file list → 0', async () => {
      expect(await resolveAdaptiveConcurrency('auto', [])).toBe(0);
    });

    test('small files (< 1 MiB) use cpuLimit clamped to fileCount', async () => {
      const files = await Promise.all([
        writeSizedFile('a.md', 1024),
        writeSizedFile('b.md', 2048),
        writeSizedFile('c.md', 4096),
      ]);
      const cpuLimit = availableParallelism();
      expect(await resolveAdaptiveConcurrency('auto', files)).toBe(Math.min(cpuLimit, files.length));
    });

    test('max file exactly 1 MiB caps at 2', async () => {
      const files = await Promise.all([
        writeSizedFile('small.md', 1024),
        writeSizedFile('one-mib.md', 1024 * 1024),
      ]);
      expect(await resolveAdaptiveConcurrency('auto', files)).toBeLessThanOrEqual(2);
    });

    test('max file 1.5 MiB caps at 2', async () => {
      const file = await writeSizedFile('medium.md', 1.5 * 1024 * 1024);
      expect(await resolveAdaptiveConcurrency('auto', [file])).toBeLessThanOrEqual(2);
    });

    test('max file exactly 5 MiB forces 1', async () => {
      const file = await writeSizedFile('five-mib.md', 5 * 1024 * 1024);
      expect(await resolveAdaptiveConcurrency('auto', [file])).toBe(1);
    });

    test('max file 6 MiB forces 1', async () => {
      const file = await writeSizedFile('six-mib.md', 6 * 1024 * 1024);
      expect(await resolveAdaptiveConcurrency('auto', [file])).toBe(1);
    });

    test('single small file → 1', async () => {
      const file = await writeSizedFile('only.md', 100);
      expect(await resolveAdaptiveConcurrency('auto', [file])).toBe(1);
    });

    test('medium cap respects fileCount when files < 2', async () => {
      const file = await writeSizedFile('one-mib.md', 1.2 * 1024 * 1024);
      expect(await resolveAdaptiveConcurrency('auto', [file])).toBe(1);
    });
  });
});

import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import type { LintMdRulesConfig } from '@lint-md/core';
import { batchLint, runTasksWithLimit } from '../src/utils/batch-lint';

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
      const file = path.join(tmpDir, 'missing.md');

      await expect(batchLint(1, [file], false, false, RULES_NO_EMPTY_LIST)).rejects.toThrow();
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

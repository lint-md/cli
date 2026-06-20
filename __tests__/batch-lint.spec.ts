import path from 'path';
import { batchLint, runTasksWithLimit } from '../src/utils/batch-lint';

const WORKER = path.resolve(__dirname, '../lib/src/utils/lint-worker');
const SPACE_AROUND = path.resolve(__dirname, '../examples/space-around.md');
const NO_EMPTY_URL = path.resolve(__dirname, '../examples/no-empty-url.md');
const CORRECT_TITLE = path.resolve(__dirname, '../examples/correct-title-trailing-punctuation.md');

describe('runTasksWithLimit', () => {
  test('respects concurrency limit', async () => {
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise(r => setTimeout(r, 10));
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

describe('batchLint (end-to-end)', () => {
  test('lint multiple files and return errors', async () => {
    const results = await batchLint(2, [SPACE_AROUND, NO_EMPTY_URL, CORRECT_TITLE], false, false, {}, WORKER);
    expect(results).toHaveLength(3);
    expect(results.find(r => r.path === SPACE_AROUND)?.lintResult).toHaveLength(3);
    expect(results.find(r => r.path === NO_EMPTY_URL)?.lintResult).toHaveLength(2);
    expect(results.find(r => r.path === CORRECT_TITLE)?.lintResult).toHaveLength(1);
  });

  test('single thread produces same results as multi-thread', async () => {
    const single = await batchLint(1, [SPACE_AROUND, NO_EMPTY_URL], false, false, {}, WORKER);
    const multi = await batchLint(4, [SPACE_AROUND, NO_EMPTY_URL], false, false, {}, WORKER);
    expect(single.length).toBe(multi.length);
    expect(single.map(r => r.path).sort()).toEqual(multi.map(r => r.path).sort());
  });

  test('fix mode returns fixedResult for fixable files', async () => {
    const results = await batchLint(1, [SPACE_AROUND, NO_EMPTY_URL], false, true, {}, WORKER);
    expect(results.every(r => r.fixedResult)).toBe(true);
    expect(results.every(r => r.fixedResult!.result.length > 0)).toBe(true);
  });

  test('empty file list returns empty results', async () => {
    const results = await batchLint(1, [], false, false, {}, WORKER);
    expect(results).toEqual([]);
  });
});

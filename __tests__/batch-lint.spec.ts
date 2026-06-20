import { runTasksWithLimit } from '../src/utils/batch-lint';

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

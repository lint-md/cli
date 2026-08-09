import { runTasksWithLimit } from "../src/utils/run-tasks-with-limit";

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
    const tasks = [3, 1, 4, 1, 5].map((value) => async () => value);

    await expect(runTasksWithLimit(tasks, 2)).resolves.toEqual([3, 1, 4, 1, 5]);
  });

  test("handles an empty task list", async () => {
    await expect(runTasksWithLimit([], 3)).resolves.toEqual([]);
  });

  test("supports a limit greater than the task count", async () => {
    const tasks = [1, 2, 3].map((value) => async () => value * 10);

    await expect(runTasksWithLimit(tasks, 10)).resolves.toEqual([10, 20, 30]);
  });

  test("propagates task rejection", async () => {
    const failure = new Error("task failed");

    await expect(
      runTasksWithLimit([async () => 1, async () => Promise.reject(failure)], 2)
    ).rejects.toBe(failure);
  });
});

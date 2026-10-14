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

  test("waits for running tasks and stops scheduling after a rejection", async () => {
    const failure = new Error("task failed");
    const started: number[] = [];
    let markFirstFailed!: () => void;
    let markSecondStarted!: () => void;
    let releaseSecond!: () => void;
    const firstFailed = new Promise<void>((resolve) => {
      markFirstFailed = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const secondRelease = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const tasks = [
      async () => {
        started.push(0);
        await secondStarted;
        markFirstFailed();
        throw failure;
      },
      async () => {
        started.push(1);
        markSecondStarted();
        await secondRelease;
        return 1;
      },
      async () => {
        started.push(2);
        return 2;
      },
      async () => {
        started.push(3);
        return 3;
      },
    ];

    const run = runTasksWithLimit(tasks, 2);
    let settled = false;
    void run.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await firstFailed;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(started).toEqual([0, 1]);

    releaseSecond();
    await expect(run).rejects.toBe(failure);

    expect(started).toEqual([0, 1]);
  });

  test("reports the first failure after all running tasks reject", async () => {
    const firstFailure = new Error("first task failed");
    const secondFailure = new Error("second task failed");
    let releaseSecond!: () => void;
    const secondRelease = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const run = runTasksWithLimit(
      [
        async () => {
          throw firstFailure;
        },
        async () => {
          await secondRelease;
          throw secondFailure;
        },
      ],
      2
    );

    await new Promise<void>((resolve) => setImmediate(resolve));
    releaseSecond();

    await expect(run).rejects.toBe(firstFailure);
  });
});

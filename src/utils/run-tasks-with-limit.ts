export async function runTasksWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let failed = false;
  let firstError: unknown;

  async function runNext(): Promise<void> {
    while (!failed && index < tasks.length) {
      const currentIndex = index++;

      try {
        results[currentIndex] = await tasks[currentIndex]();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    runNext()
  );
  await Promise.all(workers);
  if (failed) {
    throw firstError;
  }
  return results;
}

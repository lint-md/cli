import { stat } from "fs/promises";
import { runTasksWithLimit } from "./run-tasks-with-limit";

// Bound stat calls to prevent file descriptor bursts in large repositories.
export const STAT_CONCURRENCY_LIMIT = 128;

export const getMaxFileSize = async (filePaths: string[]): Promise<number> => {
  if (filePaths.length === 0) {
    return 0;
  }

  // Scan all files because dev output reports the true maximum size.
  const sizes = await runTasksWithLimit(
    filePaths.map(
      (filePath) => () => stat(filePath).then((stats) => stats.size)
    ),
    STAT_CONCURRENCY_LIMIT
  );

  return sizes.reduce((max, current) => (current > max ? current : max), 0);
};

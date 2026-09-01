import { stat } from "fs/promises";
import { runTasksWithLimit } from "./run-tasks-with-limit";

// Bound stat calls to prevent file descriptor bursts in large repositories.
export const STAT_CONCURRENCY_LIMIT = 128;

export interface FileStat {
  path: string;
  size: number;
}

export const statFiles = async (filePaths: string[]): Promise<FileStat[]> =>
  runTasksWithLimit(
    filePaths.map((filePath) => async () => ({
      path: filePath,
      size: (await stat(filePath)).size,
    })),
    STAT_CONCURRENCY_LIMIT
  );

export const getMaxFileSize = (fileStats: FileStat[]): number =>
  fileStats.reduce((max, current) => Math.max(max, current.size), 0);

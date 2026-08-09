import { stat } from "fs/promises";
import { STAT_CONCURRENCY_LIMIT } from "./file-stat";
import { formatBytes } from "./parse-size";
import { runTasksWithLimit } from "./run-tasks-with-limit";

// Keep the stat limit aligned with getMaxFileSize() to prevent fd bursts.
// A stat failure propagates to the CLI error handler.
export const filterFilesByMaxSize = async (
  mdFiles: string[],
  limitBytes: number
): Promise<string[]> => {
  const results = await runTasksWithLimit(
    mdFiles.map((file) => async () => {
      const { size } = await stat(file);
      if (size > limitBytes) {
        console.error(
          `warning: skipped large Markdown file ${file}, size ${formatBytes(
            size
          )} exceeds limit ${formatBytes(limitBytes)}`
        );
        return null;
      }
      return file;
    }),
    STAT_CONCURRENCY_LIMIT
  );

  return results.filter((file): file is string => file !== null);
};

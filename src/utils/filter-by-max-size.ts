import { stat } from 'fs/promises';
import { STAT_CONCURRENCY_LIMIT, runTasksWithLimit } from './batch-lint';
import { formatMiB } from './parse-size';

// Drops Markdown files larger than limitBytes, emitting a stderr warning for
// each skipped file. Stat concurrency is bounded by STAT_CONCURRENCY_LIMIT
// (reused from batch-lint) so this does not reintroduce the N-fd stat burst
// that #80 removed. A stat failure propagates upward, matching the existing
// error boundary.
export const filterFilesByMaxSize = async (
  mdFiles: string[],
  limitBytes: number
): Promise<string[]> => {
  const results = await runTasksWithLimit(
    mdFiles.map(file => async () => {
      const { size } = await stat(file);
      if (size > limitBytes) {
        console.error(
          `warning: skipped large Markdown file ${file}, size ${formatMiB(size)} exceeds limit ${formatMiB(limitBytes)}`
        );
        return null;
      }
      return file;
    }),
    STAT_CONCURRENCY_LIMIT
  );

  return results.filter((file): file is string => file !== null);
};

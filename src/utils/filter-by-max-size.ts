import type { FileStat } from "./file-stat";
import { formatBytes } from "./parse-size";
import { sanitizeTerminalText } from "./sanitize-terminal";

export const filterFilesByMaxSize = (
  fileStats: FileStat[],
  limitBytes: number
): FileStat[] =>
  fileStats.filter(({ path, size }) => {
    if (size > limitBytes) {
      console.error(
        `warning: skipped large Markdown file ${sanitizeTerminalText(
          path
        )}, size ${formatBytes(size)} exceeds limit ${formatBytes(limitBytes)}`
      );
      return false;
    }
    return true;
  });

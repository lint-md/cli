import { availableParallelism } from "os";
import type { ThreadCount } from "../types";

const ONE_MIB = 1024 * 1024;
const FIVE_MIB = 5 * ONE_MIB;
const ADAPTIVE_SMALL_CAP = 4;
const ADAPTIVE_MEDIUM_CAP = 2;
const ADAPTIVE_LARGE_FILE_THRESHOLD = ONE_MIB;
const ADAPTIVE_HUGE_FILE_THRESHOLD = FIVE_MIB;

export interface AdaptiveConcurrencyDecision {
  concurrency: number;
  maxFileSize: number | null;
  requestedConcurrency: number;
}

export const resolveAdaptiveConcurrency = async (
  threadCount: ThreadCount,
  mdFilePaths: string[],
  maxFileSize: number
): Promise<AdaptiveConcurrencyDecision> => {
  const requestedConcurrency =
    typeof threadCount === "number" ? threadCount : availableParallelism();

  if (mdFilePaths.length === 0) {
    return {
      concurrency: 0,
      maxFileSize: threadCount === "auto" ? 0 : null,
      requestedConcurrency,
    };
  }

  if (typeof threadCount === "number") {
    return {
      concurrency: Math.min(Math.max(threadCount, 1), mdFilePaths.length),
      maxFileSize: null,
      requestedConcurrency,
    };
  }

  let limit = Math.min(requestedConcurrency, ADAPTIVE_SMALL_CAP);
  if (maxFileSize >= ADAPTIVE_HUGE_FILE_THRESHOLD) {
    limit = 1;
  } else if (maxFileSize >= ADAPTIVE_LARGE_FILE_THRESHOLD) {
    limit = Math.min(limit, ADAPTIVE_MEDIUM_CAP);
  }

  return {
    concurrency: Math.min(Math.max(limit, 1), mdFilePaths.length),
    maxFileSize,
    requestedConcurrency,
  };
};

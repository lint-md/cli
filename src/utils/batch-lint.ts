import path from "path";
import { existsSync } from "fs";
import { stat } from "fs/promises";
import { availableParallelism } from "os";
import { Piscina } from "piscina";
import type { LintMdRulesConfig } from "@lint-md/core";
import type { BatchLintItem, LintWorkerOptions, ThreadCount } from "../types";
import { isIncompleteFix } from "./report-incomplete-fixes";

const ONE_MIB = 1024 * 1024;
const FIVE_MIB = 5 * ONE_MIB;
const ADAPTIVE_MEDIUM_CAP = 2;
const ADAPTIVE_LARGE_FILE_THRESHOLD = ONE_MIB;
const ADAPTIVE_HUGE_FILE_THRESHOLD = FIVE_MIB;
// Upper bound on concurrent stat() fds in getMaxFileSize (see #80).
export const STAT_CONCURRENCY_LIMIT = 128;

export async function runTasksWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    runNext()
  );
  await Promise.all(workers);
  return results;
}

const resolveWorkerFilename = (): string => {
  const compiled = path.resolve(__dirname, "./lint-worker.js");
  if (existsSync(compiled)) {
    return compiled;
  }
  return path.resolve(__dirname, "../../lib/src/utils/lint-worker.js");
};

// getMaxFileSize() stats every file but bounds the in-flight stat calls to
// STAT_CONCURRENCY_LIMIT via runTasksWithLimit, avoiding an N-fd filesystem
// burst on very large repositories (see #80).
// We bound concurrency rather than short-circuit on a >= 5 MiB file: this
// function must return the TRUE maximum size, because src/lint-md.ts logs
// `max file ${maxMiB} MiB` under --threads auto --dev. An early return would
// make that log (and any future consumer) inaccurate. STAT_CONCURRENCY_LIMIT
// is an empirical cap (the issue suggests 64/128), not benchmark-derived.
export const getMaxFileSize = async (filePaths: string[]): Promise<number> => {
  if (filePaths.length === 0) {
    return 0;
  }
  const sizes = await runTasksWithLimit(
    filePaths.map(
      (filePath) => () => stat(filePath).then((stats) => stats.size)
    ),
    STAT_CONCURRENCY_LIMIT
  );
  return sizes.reduce((max, current) => (current > max ? current : max), 0);
};

export const resolveAdaptiveConcurrency = async (
  threadCount: ThreadCount,
  mdFilePaths: string[]
): Promise<number> => {
  if (mdFilePaths.length === 0) {
    return 0;
  }

  if (typeof threadCount === "number") {
    return Math.min(Math.max(threadCount, 1), mdFilePaths.length);
  }

  const maxFileSize = await getMaxFileSize(mdFilePaths);
  const cpuLimit = availableParallelism();

  let limit = cpuLimit;
  if (maxFileSize >= ADAPTIVE_HUGE_FILE_THRESHOLD) {
    limit = 1;
  } else if (maxFileSize >= ADAPTIVE_LARGE_FILE_THRESHOLD) {
    limit = Math.min(limit, ADAPTIVE_MEDIUM_CAP);
  }

  return Math.min(Math.max(limit, 1), mdFilePaths.length);
};

// Keep a file's result when it has lint findings, or — in fix mode — when
// core left fixes unapplied due to conflicts. notAppliedFixes can in theory
// occur without a lint report, so we must not drop it (see #86 / P1-6
// "partially-unfixed is observable", which the #89 stderr warning surfaces).
// Also retain items whose fix pass did not fully converge (cycle / max) so
// the #98 stderr warning has a target. Older cores that predate the
// `convergence` field leave it undefined, which is treated as stable and
// filtered as before.
export const keepLintItem = (item: BatchLintItem): boolean =>
  item.lintResult.length > 0 ||
  Boolean(item.fixedResult?.notAppliedFixes?.length) ||
  isIncompleteFix(item);

export const batchLint = async (
  threadsCount: number,
  mdFilePaths: string[],
  isDev: boolean,
  isFixMode: boolean,
  rules: LintMdRulesConfig
): Promise<BatchLintItem[]> => {
  if (mdFilePaths.length === 0) {
    return [];
  }

  const concurrency = Math.min(Math.max(threadsCount, 1), mdFilePaths.length);

  const lintWorkerPool = new Piscina({
    filename: resolveWorkerFilename(),
    maxThreads: concurrency,
  });

  try {
    const results = await runTasksWithLimit<BatchLintItem>(
      mdFilePaths.map((filePath) => {
        return () =>
          lintWorkerPool.run({
            filePath,
            isFixMode,
            rules,
            isDev,
          } as LintWorkerOptions);
      }),
      concurrency
    );

    return results.filter(keepLintItem);
  } finally {
    await lintWorkerPool.destroy();
  }
};

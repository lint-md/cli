import path from "path";
import { existsSync } from "fs";
import { Piscina } from "piscina";
import type { LintMdRulesConfig } from "@lint-md/core";
import type { BatchLintItem, LintWorkerOptions } from "../types";
import { isIncompleteFix } from "./report-incomplete-fixes";
import { runTasksWithLimit } from "./run-tasks-with-limit";

const resolveWorkerFilename = (): string => {
  const compiled = path.resolve(__dirname, "./lint-worker.js");
  if (existsSync(compiled)) {
    return compiled;
  }
  return path.resolve(__dirname, "../../lib/src/utils/lint-worker.js");
};

// Keep a file's result when it has lint findings, or — in fix mode — when
// core left fixes unapplied due to conflicts. notAppliedFixes can in theory
// occur without a lint report, so we must not drop it (see #86 / P1-6
// "partially-unfixed is observable", which the #89 stderr warning surfaces).
// Also retain items whose fix pass did not fully converge (cycle / max) so
// the #98 stderr warning has a target, and items that carry rule execution
// errors so the #96 stderr warning + exit(1) have a target. Older cores
// that predate these fields leave them undefined and are filtered as before.
export const keepLintItem = (item: BatchLintItem): boolean =>
  item.lintResult.length > 0 ||
  Boolean(item.fixedResult?.notAppliedFixes?.length) ||
  isIncompleteFix(item) ||
  (item.executionErrors?.length ?? 0) > 0;

export interface BatchLintResult {
  /** Every worker result, including clean files. Used for dev metrics. */
  allResults: BatchLintItem[];
  /** Worker results filtered through `keepLintItem`. Used for I/O, warnings, and reporting. */
  actionableResults: BatchLintItem[];
}

export const batchLint = async (
  threadsCount: number,
  mdFilePaths: string[],
  isFixMode: boolean,
  rules: LintMdRulesConfig
): Promise<BatchLintResult> => {
  if (mdFilePaths.length === 0) {
    return { allResults: [], actionableResults: [] };
  }

  const concurrency = Math.min(Math.max(threadsCount, 1), mdFilePaths.length);

  const lintWorkerPool = new Piscina({
    filename: resolveWorkerFilename(),
    maxThreads: concurrency,
  });

  try {
    const allResults = await runTasksWithLimit<BatchLintItem>(
      mdFilePaths.map((filePath) => {
        return () =>
          lintWorkerPool.run({
            filePath,
            isFixMode,
            rules,
          } as LintWorkerOptions);
      }),
      concurrency
    );

    return {
      allResults,
      actionableResults: allResults.filter(keepLintItem),
    };
  } finally {
    await lintWorkerPool.destroy();
  }
};

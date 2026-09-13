import { readFile } from "fs/promises";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { BatchLintItem, CompactFixedResult, LintWorkerOptions } from "../types";
import { toBatchLintItem } from "./to-batch-lint-item";
import { isIncompleteFix } from "./report-incomplete-fixes";

// Mirrors keepLintItem conditions. An item is clean when ALL are false:
// diagnostics, notAppliedFixes, incomplete convergence, executionErrors.
const isCleanFixItem = (item: BatchLintItem): boolean =>
  item.diagnostics.length === 0 &&
  item.fixedResult != null &&
  (item.fixedResult.notAppliedFixes?.length ?? 0) === 0 &&
  !isIncompleteFix(item) &&
  (item.executionErrors?.length ?? 0) === 0;

const lintWorker = async (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode } = options;

  const content = await readFile(filePath, "utf8");
  const result = isFixMode
    ? fixMarkdown(content, { rules })
    : lintMarkdown(content, rules, false);

  const item = toBatchLintItem(filePath, result);

  // For clean fix items, project to compact form to avoid
  // structured-cloning the full Markdown text across threads.
  if (isFixMode && isCleanFixItem(item)) {
    const { convergence, metrics } = item.fixedResult!;
    const compact: CompactFixedResult = {};
    if (convergence !== undefined) compact.convergence = convergence;
    if (metrics !== undefined) compact.metrics = metrics;
    item.fixedResult = compact;
  }

  return item;
};

export default lintWorker;

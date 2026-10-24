import { readFile } from "fs/promises";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { LintWorkerOptions } from "../types";
import { toBatchLintItem } from "./to-batch-lint-item";

const lintWorker = async (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode } = options;

  const content = await readFile(filePath, "utf8");
  const result = isFixMode
    ? fixMarkdown(content, { rules })
    : lintMarkdown(content, { rules: rules ?? {} });

  // Core returns fixedResult even when no rule changed the text. Compare with
  // the content we already read so the main thread writes only real changes.
  const changed =
    isFixMode &&
    result.fixedResult != null &&
    result.fixedResult.result !== content;

  return toBatchLintItem(filePath, result, changed);
};

export default lintWorker;

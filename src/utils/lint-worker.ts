import { readFile } from "fs/promises";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { LintWorkerOptions } from "../types";
import { toBatchLintItem } from "./to-batch-lint-item";

const lintWorker = async (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode } = options;

  const content = await readFile(filePath, "utf8");
  const result = isFixMode
    ? fixMarkdown(content, { rules })
    : lintMarkdown(content, rules, false);

  return toBatchLintItem(filePath, result);
};

export default lintWorker;

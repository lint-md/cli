import { readFile } from "fs/promises";
import { lintMarkdown } from "@lint-md/core";
import type { LintWorkerOptions } from "../types";

const lintWorker = async (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode } = options;

  const content = await readFile(filePath, "utf8");
  const result = lintMarkdown(content, rules, isFixMode);

  return {
    path: filePath,
    lintResult: result.lintResult,
    fixedResult: result.fixedResult,
    fixableErrorCount: result.fixableErrorCount,
    fixableWarningCount: result.fixableWarningCount,
  };
};

export default lintWorker;

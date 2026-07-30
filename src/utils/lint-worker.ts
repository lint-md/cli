import { readFile } from "fs/promises";
import { fixMarkdown, lintMarkdown } from "@lint-md/core";
import type { LintWorkerOptions } from "../types";

const lintWorker = async (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode } = options;

  const content = await readFile(filePath, "utf8");
  const result = isFixMode
    ? fixMarkdown(content, { rules })
    : lintMarkdown(content, rules, false);

  return {
    path: filePath,
    lintResult: result.lintResult,
    fixedResult: result.fixedResult,
    fixableErrorCount: result.fixableErrorCount,
    fixableWarningCount: result.fixableWarningCount,
    executionErrors: result.executionErrors,
  };
};

export default lintWorker;

import * as fs from 'fs';
import { lintMarkdown } from '@lint-md/core';

export interface LintWorkerOptions {
  filePath: string
  rules?: any
  isFixMode?: boolean
}

const lintSingleMarkdownFile = (options: LintWorkerOptions) => {
  const { filePath, rules, isFixMode } = options;
  const fileContent = fs.readFileSync(filePath).toString();
  return lintMarkdown(fileContent, rules, isFixMode);
};

export default lintSingleMarkdownFile;

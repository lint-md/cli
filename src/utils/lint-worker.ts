import { lintMarkdown } from '@lint-md/core';

export interface LintWorkerOptions {
  content: string
  rules?: any
  isFixMode?: boolean
}

const lintSingleMarkdownFile = (options: LintWorkerOptions) => {
  const { content, rules, isFixMode } = options;
  return lintMarkdown(content, rules, isFixMode);
};

export default lintSingleMarkdownFile;

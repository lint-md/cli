import path from 'path';
import { existsSync } from 'fs';
import { Piscina } from 'piscina';
import type { LintMdRulesConfig } from '@lint-md/core';
import type { BatchLintItem, LintWorkerOptions } from '../types';

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

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

const resolveWorkerFilename = (): string => {
  const compiled = path.resolve(__dirname, './lint-worker.js');
  if (existsSync(compiled)) {
    return compiled;
  }
  return path.resolve(__dirname, '../../lib/src/utils/lint-worker.js');
};

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
        return () => lintWorkerPool.run({
          filePath,
          isFixMode,
          rules,
          isDev,
        } as LintWorkerOptions);
      }),
      concurrency
    );

    return results.filter((item) => {
      return item.lintResult.length > 0;
    });
  }
  finally {
    await lintWorkerPool.destroy();
  }
};

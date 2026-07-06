#!/usr/bin/env node

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const benchmark = path.join(scriptsDir, 'benchmark-memory.mjs');
const result = spawnSync(
  process.execPath,
  [
    benchmark,
    '--files',
    '2',
    '--bytes-per-file',
    '1024',
    '--threads',
    '1',
  ],
  {
    encoding: 'utf8',
  }
);

const output = `${result.stdout}${result.stderr}`;

if (result.status !== 0 || !output.includes('Maximum resident set size')) {
  process.stderr.write(output);
  process.exit(result.status ?? 1);
}

console.log('memory benchmark smoke OK');

#!/usr/bin/env node

import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeCommand = '/usr/bin/time';

const usage = `Usage: node scripts/benchmark-memory.mjs [options]

Linux only: requires GNU /usr/bin/time -v.

Options:
  --files <count>            Number of generated Markdown files (default: 8)
  --bytes-per-file <bytes>   Approximate bytes per file (default: 65536)
  --threads <count|auto>     lint-md worker count or "auto" (default: 2)
  --runs <count>             Number of benchmark repetitions (default: 1)
  --fix                      Benchmark fix mode
  -h, --help                 Show this help
`;

const parsePositiveInteger = (value, option) => {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${option} must be a positive integer`);
  }

  return Number(value);
};

const parseThreads = (value, option) => {
  if (value === 'auto') {
    return 'auto';
  }
  return parsePositiveInteger(value, option);
};

const parseArgs = (args) => {
  const options = {
    files: 8,
    bytesPerFile: 65536,
    threads: 2,
    runs: 1,
    fix: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '-h' || arg === '--help') {
      console.log(usage);
      process.exit(0);
    }

    if (arg === '--fix') {
      options.fix = true;
      continue;
    }

    const value = args[index + 1];
    if (value === undefined) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--files') {
      options.files = parsePositiveInteger(value, arg);
    }
    else if (arg === '--bytes-per-file') {
      options.bytesPerFile = parsePositiveInteger(value, arg);
    }
    else if (arg === '--threads') {
      options.threads = parseThreads(value, arg);
    }
    else if (arg === '--runs') {
      options.runs = parsePositiveInteger(value, arg);
    }
    else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  return options;
};

if (process.platform !== 'linux') {
  throw new Error(
    `Unsupported platform: ${process.platform}. `
    + 'This benchmark currently requires GNU time on Linux.'
  );
}

if (!existsSync(timeCommand)) {
  throw new Error('GNU /usr/bin/time is required for this Linux benchmark');
}

const options = parseArgs(process.argv.slice(2));
const fixtureDir = mkdtempSync(path.join(tmpdir(), 'lint-md-memory-'));

try {
  const prefix = '# Title\n\n';
  const bodyLength = Math.max(options.bytesPerFile - prefix.length - 1, 0);
  const body = 'word '.repeat(Math.ceil(bodyLength / 5)).slice(0, bodyLength);
  const content = `${prefix}${body}\n`;
  const filePaths = [];

  for (let index = 0; index < options.files; index += 1) {
    const filePath = path.join(fixtureDir, `fixture-${index}.md`);
    writeFileSync(filePath, content);
    filePaths.push(filePath);
  }

  const tsx = path.join(rootDir, 'node_modules/tsx/dist/cli.mjs');
  const cli = path.join(rootDir, 'src/lint-md.ts');
  const cliArgs = [
    '-v',
    process.execPath,
    tsx,
    cli,
    '--threads',
    String(options.threads),
  ];

  if (options.fix) {
    cliArgs.push('--fix');
  }

  cliArgs.push(...filePaths);

  const benchmarkConfig = {
    files: options.files,
    bytesPerFile: content.length,
    totalInputBytes: content.length * options.files,
    threads: options.threads,
    fix: options.fix,
    runs: options.runs,
  };
  const measurements = [];

  console.log(JSON.stringify({ type: 'config', ...benchmarkConfig }));

  for (let run = 1; run <= options.runs; run += 1) {
    const result = spawnSync(timeCommand, cliArgs, {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        LC_ALL: 'C',
      },
      maxBuffer: 10 * 1024 * 1024,
    });

    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }

    const rssMatch = result.stderr.match(
      /Maximum resident set size \(kbytes\): (\d+)/
    );
    const elapsedMatch = result.stderr.match(
      /Elapsed \(wall clock\) time \(h:mm:ss or m:ss\): ([\d:.]+)/
    );

    measurements.push({
      run,
      maxRssKiB: rssMatch ? Number(rssMatch[1]) : null,
      elapsed: elapsedMatch?.[1] ?? null,
    });
  }

  console.log(JSON.stringify({
    type: 'summary',
    ...benchmarkConfig,
    measurements,
  }));
}
finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

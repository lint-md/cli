#!/usr/bin/env node

/**
 * RSS comparison benchmark for compact fix results.
 *
 * Runs the existing benchmark-memory.mjs on both the current branch
 * (compact results) and the baseline (full results), then prints
 * a side-by-side comparison.
 *
 * Linux only: requires GNU /usr/bin/time -v.
 *
 * Usage: node scripts/benchmark-compact-fix.mjs [options]
 *
 * Options:
 *   --files <count>            Number of generated Markdown files (default: 1000)
 *   --bytes-per-file <bytes>   Approximate bytes per file (default: 65536)
 *   --threads <count|auto>     Worker thread count (default: 4)
 *   --runs <count>             Benchmark repetitions (default: 3)
 *   -h, --help                 Show this help
 */

import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkScript = path.join(rootDir, 'scripts/benchmark-memory.mjs');
const timeCommand = '/usr/bin/time';

const usage = `Usage: node scripts/benchmark-compact-fix.mjs [options]

Linux only: requires GNU /usr/bin/time -v.

Runs the benchmark on the current branch (compact) and baseline (full),
then prints a side-by-side comparison.

Options:
  --files <count>            Number of generated Markdown files (default: 1000)
  --bytes-per-file <bytes>   Approximate bytes per file (default: 65536)
  --threads <count|auto>     Worker thread count (default: 4)
  --runs <count>             Benchmark repetitions (default: 3)
  -h, --help                 Show this help
`;

const parsePositiveInteger = (value, option) => {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${option} must be a positive integer`);
  }
  return Number(value);
};

const parseArgs = (args) => {
  const options = { files: 1000, bytesPerFile: 65536, threads: 4, runs: 3 };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') { console.log(usage); process.exit(0); }
    const val = args[i + 1];
    if (val === undefined) throw new Error(`Missing value for ${arg}`);
    if (arg === '--files') options.files = parsePositiveInteger(val, arg);
    else if (arg === '--bytes-per-file') options.bytesPerFile = parsePositiveInteger(val, arg);
    else if (arg === '--threads') options.threads = val === 'auto' ? 'auto' : parsePositiveInteger(val, arg);
    else if (arg === '--runs') options.runs = parsePositiveInteger(val, arg);
    else throw new Error(`Unknown option: ${arg}`);
    i += 1;
  }
  return options;
};

const runBenchmark = (label) => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'lint-md-compact-'));
  try {
    const prefix = '# Title\n\n';
    const bodyLen = Math.max(options.bytesPerFile - prefix.length - 1, 0);
    const body = 'word '.repeat(Math.ceil(bodyLen / 5)).slice(0, bodyLen);
    const content = `${prefix}${body}\n`;
    const filePaths = [];

    for (let i = 0; i < options.files; i += 1) {
      const fp = path.join(fixtureDir, `fixture-${i}.md`);
      writeFileSync(fp, content);
      filePaths.push(fp);
    }

    const cliArgs = [
      process.execPath,
      path.join(rootDir, 'lib/src/lint-md.js'),
      '--fix',
      '--threads', String(options.threads),
      ...filePaths,
    ];

    const measurements = [];
    for (let run = 1; run <= options.runs; run += 1) {
      const result = spawnSync(timeCommand, cliArgs, {
        cwd: rootDir,
        encoding: 'utf8',
        env: { ...process.env, LC_ALL: 'C' },
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.error) throw result.error;
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        throw new Error(`${label} run ${run} exited with code ${result.status}`);
      }

      const rssMatch = result.stderr.match(/Maximum resident set size \(kbytes\): (\d+)/)
        || result.stderr.match(/(\d+)maxresident\)k/);
      const elapsedMatch = result.stderr.match(/Elapsed \(wall clock\) time.*?: ([\d:.]+)/)
        || result.stderr.match(/([\d:.]+)elapsed/);
      measurements.push({
        run,
        maxRssKiB: rssMatch ? Number(rssMatch[1]) : null,
        elapsed: elapsedMatch?.[1] ?? null,
      });
    }

    return { label, config: options, measurements };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
};

if (process.platform !== 'linux') {
  throw new Error(`Unsupported platform: ${process.platform}. Requires GNU time on Linux.`);
}
if (!existsSync(timeCommand)) {
  throw new Error('GNU /usr/bin/time is required for this benchmark');
}

const options = parseArgs(process.argv.slice(2));

// Get current branch name
const currentBranch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
  cwd: rootDir, encoding: 'utf8',
}).stdout.trim();

// Get baseline commit (last commit on master before this branch)
const baseRef = spawnSync('git', ['merge-base', 'master', currentBranch], {
  cwd: rootDir, encoding: 'utf8',
}).stdout.trim();

console.log(`\n=== RSS Benchmark: compact fix results ===`);
console.log(`Current:  ${currentBranch}`);
console.log(`Baseline: ${baseRef.slice(0, 8)}\n`);

// Run on current branch (compact)
console.log(`>>> Running on current branch (${currentBranch})...`);
const compact = runBenchmark('compact');

// Stash, checkout baseline, run, restore
console.log(`\n>>> Stashing changes and checking out baseline...`);
spawnSync('git', ['stash'], { cwd: rootDir, encoding: 'utf8' });
spawnSync('git', ['checkout', baseRef], { cwd: rootDir, encoding: 'utf8' });

// Rebuild for baseline
console.log(`>>> Building baseline...`);
spawnSync('npm', ['run', 'build'], { cwd: rootDir, encoding: 'utf8', stdio: 'inherit' });

console.log(`>>> Running on baseline (${baseRef.slice(0, 8)})...`);
const baseline = runBenchmark('baseline');

// Restore
console.log(`\n>>> Restoring current branch...`);
spawnSync('git', ['checkout', currentBranch], { cwd: rootDir, encoding: 'utf8' });
spawnSync('git', ['stash', 'pop'], { cwd: rootDir, encoding: 'utf8' });

// Rebuild for current
console.log(`>>> Rebuilding current branch...`);
spawnSync('npm', ['run', 'build'], { cwd: rootDir, encoding: 'utf8', stdio: 'inherit' });

// Print comparison
const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
const compactRss = compact.measurements.map((m) => m.maxRssKiB).filter(Boolean);
const baselineRss = baseline.measurements.map((m) => m.maxRssKiB).filter(Boolean);
const compactAvg = avg(compactRss);
const baselineAvg = avg(baselineRss);
const delta = baselineAvg - compactAvg;
const pct = baselineAvg > 0 ? ((delta / baselineAvg) * 100).toFixed(1) : '0.0';

console.log(`\n=== Results ===`);
console.log(`Config: ${options.files} files × ${options.bytesPerFile} bytes, --fix --threads ${options.threads}, ${options.runs} runs`);
console.log(`\n                baseline (full)    compact          delta`);
console.log(`Peak RSS (avg)  ${(baselineAvg / 1024).toFixed(1)} MiB          ${(compactAvg / 1024).toFixed(1)} MiB          ${(delta > 0 ? '-' : '+')}${(Math.abs(delta) / 1024).toFixed(1)} MiB (${pct}%)`);
console.log(`\nPer-run detail:`);
console.log(`  baseline: ${baselineRss.map((v) => `${(v / 1024).toFixed(1)}M`).join(', ')}`);
console.log(`  compact:  ${compactRss.map((v) => `${(v / 1024).toFixed(1)}M`).join(', ')}`);

console.log(JSON.stringify({
  type: 'comparison',
  baseline: { measurements: baseline.measurements, avgRssKiB: baselineAvg },
  compact: { measurements: compact.measurements, avgRssKiB: compactAvg },
  deltaRssKiB: delta,
  deltaPercent: Number(pct),
}));

#!/usr/bin/env node

/**
 * Piscina(1) vs direct lintWorker invocation.
 *
 * Both paths call the same lintWorker function:
 *   readFile → fixMarkdown → toBatchLintItem
 *
 * The only difference:
 *   - Direct: call lintWorker() in the same thread
 *   - Piscina: call lintWorker() through Piscina(maxThreads=1)
 *
 * Linux only: requires GNU /usr/bin/time -v.
 *
 * Usage: node scripts/benchmark-piscina-vs-direct.mjs [options]
 *
 * Options:
 *   --sizes <sizes>    Comma-separated file sizes (default: 1mb,2mb,4mb,6mb,8mb,10mb,12mb)
 *   --runs <count>     Repetitions per cell (default: 3)
 *   --fix              Benchmark fix mode
 *   -h, --help         Show this help
 */

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

const usage = `Usage: node scripts/benchmark-piscina-vs-direct.mjs [options]

Linux only: requires GNU /usr/bin/time -v.

Compares Piscina(maxThreads=1) vs direct lintWorker invocation.
Run \`npm run build\` first.

Options:
  --sizes <sizes>    Comma-separated file sizes (default: 1mb,2mb,4mb,6mb,8mb,10mb,12mb)
  --runs <count>     Repetitions per cell (default: 3)
  --fix              Benchmark fix mode
  -h, --help         Show this help
`;

const parseSize = (str) => {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i);
  if (!match) throw new Error(`Invalid size: ${str}`);
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'b') return n;
  if (unit === 'kb') return n * 1024;
  if (unit === 'mb') return n * 1024 * 1024;
  if (unit === 'gb') return n * 1024 * 1024 * 1024;
};

const formatSize = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
};

const parseArgs = (args) => {
  const options = {
    sizes: [1, 2, 4, 6, 8, 10, 12].map(n => n * 1024 * 1024),
    runs: 3,
    fix: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') { console.log(usage); process.exit(0); }
    if (arg === '--fix') { options.fix = true; continue; }
    const val = args[i + 1];
    if (val === undefined) throw new Error(`Missing value for ${arg}`);
    if (arg === '--sizes') {
      options.sizes = val.split(',').map(parseSize);
    } else if (arg === '--runs') {
      options.runs = Number(val);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    i += 1;
  }
  return options;
};

const parseRss = (stderr) => {
  const m = stderr.match(/Maximum resident set size \(kbytes\): (\d+)/)
    || stderr.match(/(\d+)maxresident\)k/);
  return m ? Number(m[1]) : null;
};

const parseElapsed = (stderr) => {
  const m = stderr.match(/Elapsed \(wall clock\) time.*?: ([\d:.]+)/)
    || stderr.match(/([\d:.]+)elapsed/);
  return m?.[1] ?? null;
};

const measure = (label, cliArgs) => {
  const result = spawnSync(timeCommand, cliArgs, {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      LC_ALL: 'C',
      NODE_PATH: path.join(rootDir, 'node_modules'),
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${label} exited with code ${result.status}`);
  }

  return {
    maxRssKiB: parseRss(result.stderr),
    elapsed: parseElapsed(result.stderr),
  };
};

if (process.platform !== 'linux') {
  throw new Error(`Unsupported platform: ${process.platform}. Requires GNU time.`);
}
if (!existsSync(timeCommand)) {
  throw new Error('GNU /usr/bin/time is required.');
}

const builtCli = path.join(rootDir, 'lib/src/lint-md.js');
if (!existsSync(builtCli)) {
  throw new Error(`Built CLI not found at ${builtCli}. Run \`npm run build\` first.`);
}

const options = parseArgs(process.argv.slice(2));
const fixtureDir = mkdtempSync(path.join(tmpdir(), 'lint-md-piscina-'));

try {
  console.log(`\n=== Piscina(1) vs Direct lintWorker ===`);
  console.log(`Mode: ${options.fix ? 'fix' : 'lint'}, Runs: ${options.runs}\n`);

  const results = [];

  for (const sizeBytes of options.sizes) {
    const sizeLabel = formatSize(sizeBytes);

    // Create a single large file
    const file = path.join(fixtureDir, `large-${sizeLabel.replace(/\s/g, '-')}.md`);
    const prefix = '# Title\n\n';
    const bodyLen = Math.max(sizeBytes - prefix.length - 1, 0);
    const body = 'word '.repeat(Math.ceil(bodyLen / 5)).slice(0, bodyLen);
    writeFileSync(file, `${prefix}${body}\n`);

    console.log(`--- ${sizeLabel} file ---`);

    // Direct: call lintWorker in the same process via a small Node script
    const directScript = `
      const lintWorker = require('${rootDir}/lib/src/utils/lint-worker.js').default;
      (async () => {
        await lintWorker({
          filePath: '${file}',
          rules: {},
          isFixMode: ${options.fix},
        });
      })();
    `;
    const directScriptPath = path.join(fixtureDir, 'direct-lint.cjs');
    writeFileSync(directScriptPath, directScript);

    const directArgs = [
      process.execPath, directScriptPath,
    ];
    const directMeasurements = [];
    for (let r = 1; r <= options.runs; r++) {
      const m = measure('direct', directArgs);
      directMeasurements.push(m);
      process.stdout.write(`  direct    run ${r}: RSS=${m.maxRssKiB ? (m.maxRssKiB / 1024).toFixed(0) : '?'} MiB  wall=${m.elapsed ?? '?'}\n`);
    }

    // Piscina: call lintWorker through Piscina(maxThreads=1)
    const piscinaScript = `
      const { Piscina } = require('piscina');
      const piscina = new Piscina({
        filename: '${rootDir}/lib/src/utils/lint-worker.js',
        maxThreads: 1,
      });
      (async () => {
        await piscina.run({
          filePath: '${file}',
          rules: {},
          isFixMode: ${options.fix},
        });
      })();
    `;
    const piscinaScriptPath = path.join(fixtureDir, 'piscina-lint.cjs');
    writeFileSync(piscinaScriptPath, piscinaScript);

    const piscinaArgs = [
      process.execPath, piscinaScriptPath,
    ];
    const piscinaMeasurements = [];
    for (let r = 1; r <= options.runs; r++) {
      const m = measure('piscina', piscinaArgs);
      piscinaMeasurements.push(m);
      process.stdout.write(`  piscina   run ${r}: RSS=${m.maxRssKiB ? (m.maxRssKiB / 1024).toFixed(0) : '?'} MiB  wall=${m.elapsed ?? '?'}\n`);
    }

    const avg = (arr, key) => {
      const vals = arr.map(m => m[key]).filter(v => v != null);
      if (vals.length === 0) return null;
      if (key === 'maxRssKiB') return vals.reduce((s, v) => s + v, 0) / vals.length;
      // Parse elapsed "m:ss.ms" to seconds
      const secs = vals.map(v => {
        const parts = v.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
      });
      return secs.reduce((s, v) => s + v, 0) / secs.length;
    };

    const piscinaAvgRss = avg(piscinaMeasurements, 'maxRssKiB');
    const directAvgRss = avg(directMeasurements, 'maxRssKiB');
    const piscinaAvgWall = avg(piscinaMeasurements, 'elapsed');
    const directAvgWall = avg(directMeasurements, 'elapsed');

    const rssDelta = piscinaAvgRss != null && directAvgRss != null
      ? ((piscinaAvgRss - directAvgRss) / directAvgRss * 100)
      : null;
    const wallDelta = piscinaAvgWall != null && directAvgWall != null
      ? ((piscinaAvgWall - directAvgWall) / directAvgWall * 100)
      : null;

    const fmtPct = (v) => v == null ? '?' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

    process.stdout.write(
      `  delta (piscina vs direct):  RSS ${fmtPct(rssDelta)}  wall ${fmtPct(wallDelta)}\n\n`
    );

    results.push({
      sizeBytes,
      sizeLabel,
      piscina: {
        avgRssKiB: piscinaAvgRss,
        avgWallSec: piscinaAvgWall,
        measurements: piscinaMeasurements,
      },
      direct: {
        avgRssKiB: directAvgRss,
        avgWallSec: directAvgWall,
        measurements: directMeasurements,
      },
      rssDeltaPercent: rssDelta,
      wallDeltaPercent: wallDelta,
    });
  }

  // Summary table
  const fmtPct = (v) => v == null ? '?' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  console.log(`\n=== Summary ===`);
  console.log(`delta = (piscina - direct) / direct * 100 (positive = Piscina higher)`);
  console.log(`File Size  | Piscina RSS | Direct RSS | Δ RSS        | Piscina wall | Direct wall | Δ wall`);
  console.log(`-----------|-------------|------------|--------------|--------------|-------------|-------`);
  for (const r of results) {
    const pRss = r.piscina.avgRssKiB ? `${(r.piscina.avgRssKiB / 1024).toFixed(0)} MiB`.padStart(11) : '?'.padStart(11);
    const dRss = r.direct.avgRssKiB ? `${(r.direct.avgRssKiB / 1024).toFixed(0)} MiB`.padStart(10) : '?'.padStart(10);
    const pWall = r.piscina.avgWallSec != null ? `${r.piscina.avgWallSec.toFixed(1)}s`.padStart(12) : '?'.padStart(12);
    const dWall = r.direct.avgWallSec != null ? `${r.direct.avgWallSec.toFixed(1)}s`.padStart(11) : '?'.padStart(11);
    const rssStr = fmtPct(r.rssDeltaPercent).padStart(12);
    const wallStr = fmtPct(r.wallDeltaPercent).padStart(7);
    console.log(
      `${r.sizeLabel.padEnd(9)} | ${pRss} | ${dRss} | ${rssStr} | ${pWall} | ${dWall} | ${wallStr}`,
    );
  }

  console.log(JSON.stringify({ type: 'piscina-vs-direct', results }));
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

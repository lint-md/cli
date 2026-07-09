import { writeFileSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { filterFilesByMaxSize } from '../src/utils/filter-by-max-size';
import { STAT_CONCURRENCY_LIMIT } from '../src/utils/batch-lint';
import { parseSize } from '../src/utils/parse-size';

const TSX = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
const CLI = path.resolve(__dirname, '../src/lint-md.ts');

const VIOLATION = '1. hello\n2.\n';

describe('filterFilesByMaxSize (unit)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'max-file-size-unit-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('drops files above the limit and warns to stderr', async () => {
    const small = path.join(tmpDir, 'small.md');
    const large = path.join(tmpDir, 'large.md');
    await writeFile(small, VIOLATION, 'utf8');
    await writeFile(large, `${Buffer.alloc(200 * 1024, 'a')}\n${VIOLATION}`, 'utf8');

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const kept = await filterFilesByMaxSize([small, large], parseSize('1kb'));
      expect(kept).toEqual([small]);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('warning: skipped large Markdown file')
      );
      expect(errorSpy.mock.calls[0][0]).toContain(large);
    }
    finally {
      errorSpy.mockRestore();
    }
  });

  test('keeps all files when none exceed the limit', async () => {
    const a = path.join(tmpDir, 'a.md');
    const b = path.join(tmpDir, 'b.md');
    await writeFile(a, VIOLATION, 'utf8');
    await writeFile(b, VIOLATION, 'utf8');

    const kept = await filterFilesByMaxSize([a, b], parseSize('10mb'));
    expect(kept.sort()).toEqual([a, b].sort());
  });

  test('bounds stat concurrency to STAT_CONCURRENCY_LIMIT', async () => {
    const fileCount = STAT_CONCURRENCY_LIMIT * 3;
    const filePaths = Array.from({ length: fileCount }, (_, index) =>
      path.join(tmpDir, `f-${index}.md`)
    );
    const sizeMap = new Map(filePaths.map((filePath, index) => [filePath, index + 1]));

    let inFlight = 0;
    let maxInFlight = 0;
    const fsPromises = require('fs/promises');
    const statSpy = jest.spyOn(fsPromises, 'stat').mockImplementation((filePath: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise((resolve) => {
        setTimeout(() => {
          inFlight--;
          resolve({ size: sizeMap.get(filePath) ?? 0 });
        }, 20);
      });
    });

    try {
      const kept = await filterFilesByMaxSize(filePaths, parseSize('10mb'));
      expect(kept).toHaveLength(fileCount);
      expect(statSpy).toHaveBeenCalledTimes(fileCount);
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBeLessThanOrEqual(STAT_CONCURRENCY_LIMIT);
    }
    finally {
      statSpy.mockRestore();
    }
  });

  test('propagates stat failures', async () => {
    const missing = path.join(tmpDir, 'missing.md');
    await expect(filterFilesByMaxSize([missing], parseSize('10mb'))).rejects.toThrow();
  });
});

describe('--max-file-size CLI behavior', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'max-file-size-cli-'));
    // enable a rule so violations produce a report
    await writeFile(path.join(tmpDir, '.lintmdrc'), JSON.stringify({ rules: { 'no-empty-list': 2 } }), 'utf8');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const runCli = (args: string[]): { stdout: string; stderr: string; status: number } => {
    try {
      const stdout = execFileSync(process.execPath, [TSX, CLI, ...args], {
        cwd: tmpDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, stderr: '', status: 0 };
    }
    catch (e: any) {
      return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
    }
  };

  test('invalid size (1.5mb) -> exit 1 + stderr', () => {
    const file = path.join(tmpDir, 'a.md');
    writeFileSyncHelper(file, VIOLATION);
    const { status, stderr } = runCli([file, '--max-file-size', '1.5mb']);
    expect(status).toBe(1);
    expect(stderr).toContain('--max-file-size must be a valid size');
  });

  test('no flag -> old behavior, clean file lints without filtering', () => {
    const file = path.join(tmpDir, 'a.md');
    writeFileSyncHelper(file, '# hello\n');
    const { status, stdout } = runCli([file]);
    expect(status).toBe(0);
    expect(stdout).toContain('Done in');
  });

  test('oversized file is skipped (warning to stderr, not linted)', () => {
    const small = path.join(tmpDir, 'small.md');
    const large = path.join(tmpDir, 'large.md');
    writeFileSyncHelper(small, VIOLATION);
    writeFileSyncHelper(large, `${Buffer.alloc(200 * 1024, 'a')}\n${VIOLATION}`);
    const { status, stdout, stderr } = runCli([small, large, '--max-file-size', '100kb']);
    // small.md has a violation, so the run exits 1; the point is the large
    // file was skipped entirely (no report entry) and warned on stderr.
    expect(status).toBe(1);
    expect(stderr).toContain('warning: skipped large Markdown file');
    expect(stderr).toContain(path.basename(large));
    expect(stdout).toContain('no-empty-list');
    expect(stdout).not.toContain(path.basename(large));
  });

  test('--fix also skips the oversized file', async () => {
    const small = path.join(tmpDir, 'small.md');
    const large = path.join(tmpDir, 'large.md');
    const largeOriginal = `${Buffer.alloc(200 * 1024, 'a')}\n${VIOLATION}`;
    writeFileSyncHelper(small, VIOLATION);
    writeFileSyncHelper(large, largeOriginal);
    const { status } = runCli([small, large, '--fix', '--max-file-size', '100kb']);
    expect(status).toBe(0);
    // large file was skipped, content unchanged
    const after = await readFile(large, 'utf8');
    expect(after).toBe(largeOriginal);
  });

  test('all files filtered out -> No markdown files message', () => {
    const large = path.join(tmpDir, 'large.md');
    writeFileSyncHelper(large, `${Buffer.alloc(200 * 1024, 'a')}\n${VIOLATION}`);
    const { status, stdout } = runCli([large, '--max-file-size', '100kb']);
    expect(status).toBe(0);
    expect(stdout).toContain('🎉 No markdown files to lint 🎉');
  });

  test('works together with --threads auto on remaining files', () => {
    const small = path.join(tmpDir, 'small.md');
    const large = path.join(tmpDir, 'large.md');
    writeFileSyncHelper(small, VIOLATION);
    writeFileSyncHelper(large, `${Buffer.alloc(200 * 1024, 'a')}\n${VIOLATION}`);
    const { status, stdout, stderr } = runCli([small, large, '--max-file-size', '100kb', '--threads', 'auto']);
    // small.md has a violation, so the run exits 1; verify the large file
    // was skipped and the remaining file was still linted.
    expect(status).toBe(1);
    expect(stderr).toContain('warning: skipped large Markdown file');
    expect(stdout).toContain('no-empty-list');
  });
});

// synchronous helper for the beforeEach-style writes (tests run serially)
function writeFileSyncHelper(file: string, content: string | Buffer): void {
  writeFileSync(file, content);
}

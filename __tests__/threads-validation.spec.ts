import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

const TSX = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
const CLI = path.resolve(__dirname, '../src/lint-md.ts');

describe('--threads validation across CLI paths', () => {
  test('stdin + --threads abc → exit 1 + stderr', () => {
    try {
      execFileSync(
        process.execPath,
        [TSX, CLI, '--stdin', '--threads', 'abc'],
        {
          input: '# title\n',
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      throw new Error('should have thrown');
    }
    catch (e: any) {
      expect(e.status).toBe(1);
      expect(e.stderr).toContain('--threads must be a positive integer');
    }
  });

  test('no matching files + --threads abc → exit 1 + stderr', () => {
    try {
      execFileSync(
        process.execPath,
        [TSX, CLI, '/tmp/nonexistent-dir', '--threads', 'abc'],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      throw new Error('should have thrown');
    }
    catch (e: any) {
      expect(e.status).toBe(1);
      expect(e.stderr).toContain('--threads must be a positive integer');
    }
  });

  test('stdin + --threads auto → does not exit 1 (numeric validation skipped)', () => {
    const result = execFileSync(
      process.execPath,
      [TSX, CLI, '--stdin', '--threads', 'auto'],
      {
        input: '# title\n',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    expect(result).toContain('Done in');
  });

  test('files + --threads auto → exit 0 on a small markdown file', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'threads-auto-test-'));
    try {
      const file = path.join(tmpDir, 'small.md');
      writeFileSync(file, '# hello\n', 'utf8');

      const result = execFileSync(
        process.execPath,
        [TSX, CLI, file, '--threads', 'auto'],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      expect(result).toContain('Done in');
    }
    finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

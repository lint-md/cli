import { execFileSync } from 'child_process';
import * as path from 'path';

const CLI = path.resolve(__dirname, '../src/lint-md.ts');

describe('--threads validation across CLI paths', () => {
  test('stdin + --threads abc → exit 1 + stderr', () => {
    try {
      execFileSync(
        'npx',
        ['tsx', CLI, '--stdin', '--threads', 'abc'],
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
        'npx',
        ['tsx', CLI, '/tmp/nonexistent-dir', '--threads', 'abc'],
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
});

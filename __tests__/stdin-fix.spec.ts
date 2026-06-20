import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { lintMarkdown } from '@lint-md/core';

const CLI = path.resolve(__dirname, '../src/lint-md.ts');
const EXAMPLE = path.resolve(__dirname, '../examples/space-around.md');

describe('--stdin --fix output', () => {
  test('stdout only contains fixed markdown, no timing info', () => {
    const input = fs.readFileSync(EXAMPLE, 'utf8');

    const stdout = execFileSync(
      'npx',
      ['tsx', CLI, '--stdin', '--fix'],
      {
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    expect(stdout).not.toContain('Done in');
    expect(stdout).not.toContain('⌛️');
    expect(stdout.length).toBeGreaterThan(0);
  });

  test('fixed output passes lint with zero errors', () => {
    const input = fs.readFileSync(EXAMPLE, 'utf8');

    const stdout = execFileSync(
      'npx',
      ['tsx', CLI, '--stdin', '--fix'],
      {
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const result = lintMarkdown(stdout, {}, false);
    expect(result.lintResult).toHaveLength(0);
  });
});

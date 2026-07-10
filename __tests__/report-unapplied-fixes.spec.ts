import { getUnappliedFixesWarnings } from '../src/utils/report-unapplied-fixes';
import type { BatchLintItem } from '../src/types';

const makeItem = (overrides: Partial<BatchLintItem> = {}): BatchLintItem => ({
  path: 'doc.md',
  lintResult: [],
  ...overrides,
});

describe('getUnappliedFixesWarnings', () => {
  test('returns no warnings for an empty result', () => {
    expect(getUnappliedFixesWarnings([])).toEqual([]);
  });

  test('returns no warnings when fixedResult is null', () => {
    const result: BatchLintItem[] = [makeItem({ fixedResult: null })];
    expect(getUnappliedFixesWarnings(result)).toEqual([]);
  });

  test('returns no warnings when notAppliedFixes is empty', () => {
    const result: BatchLintItem[] = [
      makeItem({ fixedResult: { result: 'x', notAppliedFixes: [] } }),
    ];
    expect(getUnappliedFixesWarnings(result)).toEqual([]);
  });

  test('warns once with the correct count for a single unapplied fix', () => {
    const result: BatchLintItem[] = [
      makeItem({
        path: 'a.md',
        fixedResult: {
          result: 'x',
          notAppliedFixes: [{ range: [0, 1], text: 'y' }],
        },
      }),
    ];
    expect(getUnappliedFixesWarnings(result)).toEqual([
      '[lint-md] a.md: 1 fixes were not applied due to conflicts.',
    ]);
  });

  test('reports the count for multiple unapplied fixes and preserves the path', () => {
    const result: BatchLintItem[] = [
      makeItem({
        path: 'conflict.md',
        fixedResult: {
          result: 'x',
          notAppliedFixes: [
            { range: [0, 1], text: 'y' },
            { range: [2, 3], text: 'z' },
            { range: [4, 5], text: 'w' },
          ],
        },
      }),
    ];
    expect(getUnappliedFixesWarnings(result)).toEqual([
      '[lint-md] conflict.md: 3 fixes were not applied due to conflicts.',
    ]);
  });

  test('only warns for files that have unapplied fixes', () => {
    const result: BatchLintItem[] = [
      makeItem({
        path: 'ok.md',
        fixedResult: { result: 'x', notAppliedFixes: [] },
      }),
      makeItem({
        path: 'bad.md',
        fixedResult: {
          result: 'x',
          notAppliedFixes: [{ range: [0, 1], text: 'y' }],
        },
      }),
    ];
    expect(getUnappliedFixesWarnings(result)).toEqual([
      '[lint-md] bad.md: 1 fixes were not applied due to conflicts.',
    ]);
  });
});

import lintWorker from '../src/utils/lint-worker';

describe('lintWorker', () => {
  test('returns lint results for the provided content list', async () => {
    const [result] = lintWorker({
      contentList: ['中English\n'],
      isFixMode: false,
      rules: {},
    });

    expect(result.lintResult.length).toBeGreaterThan(0);
  });
});

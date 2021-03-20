import { Fix } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import { examplePath } from './test-utils';

describe('fix test', () => {
  test('fix', async () => {
    // mock fs.writeFileSync
    const fsWriteMock = jest.fn();
    (fs.writeFileSync as any) = fsWriteMock;

    const testMdPath = path.resolve(examplePath, 'no-empty-blockquote.md');

    const fixer = new Fix([testMdPath]);
    await fixer.start();
    expect(fsWriteMock).toBeCalledWith(
      testMdPath,
      ` - right

> hello world!

- wrong

`, { 'encoding': 'utf8' }
    );
  });

  test('fix markdown data that does not have any problem, we will not write file', async () => {
    // mock fs.writeFileSync
    const fsWriteMock = jest.fn();
    (fs.writeFileSync as any) = fsWriteMock;
    const testMdPath = path.resolve(examplePath, 'no-empty-blockquote.md');
    const fixer = new Fix([testMdPath], {
      rules: {
        'no-empty-blockquote': 0
      }
    });
    await fixer.start();
    // 不会 执行 fs.writeFileSync
    expect(fsWriteMock).toBeCalledTimes(0);
  });
});

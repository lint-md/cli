import { Fix } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import { examplePath } from './test-utils';

describe('fix test', () => {
  test('fix', () => {
    // mock fs.writeFileSync
    const fsWriteMock = jest.fn();
    (fs.writeFileSync as any) = fsWriteMock;

    const fixer = new Fix([path.resolve(examplePath, 'no-empty-blockquote.md')]);
    expect(fsWriteMock).toBeCalledWith('23123123');
  });
});
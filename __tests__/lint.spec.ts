import { Lint } from '../src';
import { examplePath } from './test-utils';
import { configure } from '../src/utils/configure';
import * as process from 'process';
import * as common from '../src/utils/common';
import * as chalk from 'chalk';

describe('cli linter test', () => {
  test('lint', async () => {
    const linter = new Lint([examplePath]);
    (await linter.start()).showResult().printOverview();
    expect(linter.countError()).toStrictEqual({
      error: 25,
      warning: 0,
    });
  });

  test('lint that exclude files', async () => {
    const linter = new Lint([examplePath], {
      excludeFiles: ['**/no-*'],
      rules: {},
    });
    (await linter.start()).showResult().printOverview();
    expect(linter.countError()).toStrictEqual({
      error: 7,
      warning: 0,
    });
  });

  test('lint by provided config file', async () => {
    const config = configure('./examples/.lintmdrc');
    const linter = new Lint([examplePath], config);
    (await linter.start()).showResult().printOverview();
    expect(linter.countError()).toStrictEqual({
      error: 24,
      warning: 1,
    });
  });

  test('user provide config file that does not exist', async () => {
    const mySpy = jest.spyOn(common, 'log');
    // mock process exit
    const exitMock = jest.fn();
    const realProcess = process;
    global.process = {
      ...realProcess,
      exit: exitMock as never,
    };

    // 这个配置不存在
    configure('./examples/NOT_EXIST.json');
    expect(mySpy).toBeCalledWith(
      chalk.red(
        "lint-md: Configure file './examples/NOT_EXIST.json' is not exist."
      )
    );
  });
});

import * as program from 'commander';

describe('cli tests', () => {
  beforeEach(() => {
    // 先将 argv 置为空。防止 commander 将 jest 启动的参数传入而导致异常
    process.argv = [];
  });

  test('if user does not pass any argument, we show show helps', () => {
    const helpMock = jest.fn();
    // @ts-ignore
    // eslint-disable-next-line no-import-assign
    program.help = helpMock;
    require('../src/lint-md');
    expect(helpMock).toBeCalled();
  });
});

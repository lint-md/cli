import { cpus } from 'os';
import { getThreadCount } from '../src/utils/configure';

describe('getThreadCount', () => {
  let mockExit: jest.SpyInstance;
  let mockError: jest.SpyInstance;

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    }) as never);
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
  });

  test('undefined → cpus().length', () => {
    expect(getThreadCount(undefined)).toBe(cpus().length);
  });

  test('false → cpus().length', () => {
    expect(getThreadCount(false)).toBe(cpus().length);
  });

  test('true (--threads 无值) → cpus().length', () => {
    expect(getThreadCount(true)).toBe(cpus().length);
  });

  test('number 2 → 2', () => {
    expect(getThreadCount(2)).toBe(2);
  });

  test('string "1" → 1', () => {
    expect(getThreadCount('1')).toBe(1);
  });

  test('string "4" → 4', () => {
    expect(getThreadCount('4')).toBe(4);
  });

  test.each([0, -1, '0', '-1', 'abc', '1.5', '0x10', '1e3'])('%s → exit 1 + stderr', (value) => {
    expect(() => getThreadCount(value)).toThrow('process.exit: 1');
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('--threads must be a positive integer'),
    );
  });

  test('"auto" → "auto"', () => {
    expect(getThreadCount('auto')).toBe('auto');
  });
});

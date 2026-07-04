import { sanitizeTerminalText } from '../src/utils/sanitize-terminal';

describe('sanitizeTerminalText', () => {
  test('strips OSC title sequence', () => {
    expect(sanitizeTerminalText('\u001B]0;evil title\u0007')).toBe('');
  });

  test('strips OSC 8 hyperlink sequence', () => {
    const input = '\u001B]8;;https://evil.com\u001B\\click\u001B]8;;\u001B\\';
    expect(sanitizeTerminalText(input)).toBe('click');
  });

  test('replaces CR with ^M', () => {
    expect(sanitizeTerminalText('file\rname')).toBe('file^Mname');
  });

  test('replaces NUL with ^@', () => {
    expect(sanitizeTerminalText('file\u0000name')).toBe('file^@name');
  });

  test('replaces BEL with ^G', () => {
    expect(sanitizeTerminalText('file\u0007name')).toBe('file^Gname');
  });

  test('preserves Unicode', () => {
    expect(sanitizeTerminalText('文件.md')).toBe('文件.md');
  });

  test('preserves newlines', () => {
    expect(sanitizeTerminalText('line1\nline2')).toBe('line1\nline2');
  });
});

import { stripVTControlCharacters } from 'util';

/**
 * 清理文本中的终端控制字符，防止 CI 日志伪造或终端劫持
 *
 * - 去除 ANSI CSI / OSC 序列
 * - 替换 C0 控制字符和 DEL 为可见转义
 */
export function sanitizeTerminalText(text: string): string {
  // 先去除 OSC 序列（ESC ] ... BEL 或 ESC \）
  // eslint-disable-next-line no-control-regex
  let result = text.replace(/\u001B\].*?(?:\u0007|\u001B\\)/g, '');
  // 再去除 ANSI CSI 序列
  result = stripVTControlCharacters(result);
  // 替换所有 C0 控制字符和 DEL 为可见转义
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === '\x7F') return '^?';
    return `^${String.fromCharCode(ch.charCodeAt(0) + 0x40)}`;
  });
  return result;
}

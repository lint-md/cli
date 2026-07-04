import { stripVTControlCharacters } from 'util';

/**
 * 清理文本中的终端控制字符，防止 CI 日志伪造或终端劫持
 *
 * - 去除 ANSI CSI / OSC 序列
 * - 替换 C0 控制字符为可见转义（保留 \t \n）
 */
export function sanitizeTerminalText(text: string): string {
  // 先去除 OSC 序列（ESC ] ... BEL 或 ESC \）
  // eslint-disable-next-line no-control-regex
  let result = text.replace(/\u001B\].*?(?:\u0007|\u001B\\)/g, '');
  // 再去除 ANSI CSI 序列
  result = stripVTControlCharacters(result);
  // 替换 C0 控制字符为可见转义（保留 \t 0x09, \n 0x0A）
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0B\x0C\x0D\x0E-\x1F]/g, (ch) => {
    return `^${String.fromCharCode(ch.charCodeAt(0) + 0x40)}`;
  });
  return result;
}

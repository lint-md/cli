import { constants } from 'fs';
import { open } from 'fs/promises';

/**
 * 安全写入文件，拒绝符号链接
 *
 * 使用 O_NOFOLLOW 防止最终路径是符号链接，
 * 打开后通过 fstat 验证句柄指向普通文件，解决 TOCTOU 竞态。
 */
export async function safeWriteFile(filePath: string, content: string) {
  const handle = await open(filePath, constants.O_WRONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new Error(`Refusing to write non-regular file: ${filePath}`);
    }
    await handle.truncate(0);
    await handle.writeFile(content, 'utf8');
  }
  finally {
    await handle.close();
  }
}

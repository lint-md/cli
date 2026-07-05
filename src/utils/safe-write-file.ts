import { constants } from 'fs';
import { open } from 'fs/promises';

/**
 * 安全写入文件，拒绝符号链接。
 *
 * 保留 in-place update 语义，避免 temp-file + rename 改变文件身份、
 * inode、hard link、birthtime、owner、ACL、xattr 等属性。
 *
 * 写入顺序为 write-then-truncate：
 * 先从 offset 0 写入完整新内容，再截断到新长度，避免 truncate(0)
 * 在写入失败时把文件直接变成空文件。
 *
 * 注意：这不是完全原子写入；崩溃时仍可能出现部分新内容或旧尾部残留。
 */
export async function safeWriteFile(filePath: string, content: string) {
  const handle = await open(
    filePath,
    constants.O_RDWR | constants.O_NOFOLLOW
  );

  try {
    const stat = await handle.stat();

    if (!stat.isFile()) {
      throw new Error(`Refusing to write non-regular file: ${filePath}`);
    }

    const buf = Buffer.from(content, 'utf8');

    let written = 0;
    while (written < buf.length) {
      const { bytesWritten } = await handle.write(
        buf,
        written,
        buf.length - written,
        written
      );

      if (bytesWritten === 0) {
        throw new Error(`Failed to write file: ${filePath}`);
      }

      written += bytesWritten;
    }

    await handle.truncate(buf.length);
    await handle.sync();
  }
  finally {
    await handle.close();
  }
}

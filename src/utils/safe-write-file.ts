import { constants } from 'fs';
import { chmod, open, rename, unlink, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';
import { dirname, join } from 'path';

/**
 * 安全写入文件，拒绝符号链接
 *
 * 使用 O_NOFOLLOW 验证目标不是符号链接，
 * 再通过临时文件 + rename 实现原子替换。
 */
export async function safeWriteFile(filePath: string, content: string) {
  const tempPath = join(
    dirname(filePath),
    `.lint-md-${process.pid}-${randomBytes(8).toString('hex')}.tmp`
  );

  const target = await open(
    filePath,
    constants.O_WRONLY | constants.O_NOFOLLOW
  );

  try {
    const stat = await target.stat();
    if (!stat.isFile()) {
      throw new Error(`Refusing to write non-regular file: ${filePath}`);
    }

    const mode = stat.mode & 0o777;

    await writeFile(tempPath, content, { flag: 'wx', mode });
    await chmod(tempPath, mode);
    await rename(tempPath, filePath);
  }
  finally {
    await target.close();
    try {
      await unlink(tempPath);
    }
    catch {}
  }
}

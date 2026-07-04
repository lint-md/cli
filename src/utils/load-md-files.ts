import { lstat } from 'fs/promises';
import { glob } from 'glob';

/**
 * 读取所有文件
 *
 * @param globList {string} 用户传入的文件数组
 * @param excludeFiles {string[]} 忽略的文件
 * @returns {Promise<string[]>} 读取到的文件数组
 */
export const loadMdFiles = async (
  globList: string[],
  excludeFiles: string[],
  extensions: string[] = ['.md', '.markdown', '.mdx']
) => {
  const filePaths = await Promise.all(
    // 先把 globList 去重，防止执行多余的 glob 查询
    [...new Set(globList)].map((fileList) => {
      return glob(`${fileList}`, {
        ignore: excludeFiles,
        absolute: true,
        nodir: true,
        follow: false,
      });
    })
  );

  const filtered = ([...new Set(filePaths.flat())] as string[]).filter((item) => {
    return extensions.some(ext => item.endsWith(ext));
  });

  // lstat 过滤：跳过符号链接，只忽略 ENOENT，其他错误继续抛出
  const stats = await Promise.all(
    filtered.map(async (f) => {
      try {
        return await lstat(f);
      }
      catch (e: any) {
        if (e.code === 'ENOENT')
          return null;
        throw e;
      }
    })
  );

  return filtered.filter((_, i) => stats[i] !== null && !stats[i]!.isSymbolicLink());
};

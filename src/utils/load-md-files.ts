import { glob } from 'glob';

/**
 * 读取所有文件
 *
 * @param globList {string[]} 用户传入的文件数组
 * @param excludeFiles {string[]} 忽略的文件
 * @param extensions {string[]} 文件扩展名
 * @returns {Promise<string[]>} 读取到的文件数组
 */
export const loadMdFiles = async (
  globList: string[],
  excludeFiles: string[],
  extensions: string[] = ['.md', '.markdown', '.mdx']
) => {
  const entries = await glob([...new Set(globList)], {
    ignore: excludeFiles,
    withFileTypes: true,
    nodir: true,
    follow: false,
  });

  const files = new Set<string>();

  for (const entry of entries) {
    if (entry.isSymbolicLink())
      continue;
    const fullPath = entry.fullpath();
    if (extensions.some(ext => fullPath.endsWith(ext)))
      files.add(fullPath);
  }

  return [...files];
};

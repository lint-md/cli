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
      });
    })
  );

  // 最后对获取的路径结果进行一次去重，防止重复的文件，同时只考虑 Markdown 文本
  return ([...new Set(filePaths.flat())] as string[]).filter((item) => {
    return extensions.some(ext => item.endsWith(ext));
  });
};

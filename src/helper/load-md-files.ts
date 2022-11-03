import * as glob from 'glob';
import { uniq } from 'lodash';
import type { CLIConfig } from '../types';

const promisifyGlob = (pattern: string, options: glob.IOptions) => {
  return new Promise((resolve, reject) => {
    glob(pattern, options, (err, files) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(files);
      }
    });
  });
};

/**
 * 读取所有文件
 *
 * @param globList {string} 用户传入的文件数组
 * @param config {CLIConfig} 用户传入的配置
 * @returns {Promise<string[]>} 读取到的文件数组
 */
export const loadMdFiles = async (globList: string[], config?: CLIConfig) => {
  const excludeFiles = config ? config.excludeFiles : [];

  const filePaths = await Promise.all(
    // 先把 globList 去重，防止执行多余的 glob 查询
    uniq(globList).map((fileList) => {
      return promisifyGlob(`${fileList}/**/*.{md,markdown}`, {
        ignore: excludeFiles,
      });
    })
  );

  // 最后对获取的路径结果进行一次去重，防止重复的文件
  return uniq(filePaths.flat());
};

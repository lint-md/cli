import * as path from 'path';
import * as glob from 'glob';
import { CliConfig } from '../types';
import { isDirectory, isFile } from './common';

/**
 * 读取所有文件
 *
 * @param src {string} 用户传入的文件数组
 * @param config {CliConfig} 用户传入的配置
 * @returns {Promise<string[]>} 读取到的文件数组
 */
export const loadMdFiles = (
  src: string[],
  config?: CliConfig
): Promise<string[]> => {
  const excludeFiles = config ? config.excludeFiles : [];

  return new Promise((resolve) => {
    setTimeout(() => {
      const files = [];
      const srcArr = [];

      for (let i = 0; i < src.length; i++) {
        srcArr.push(...glob.sync(src[i]));
      }

      for (let i = 0; i < srcArr.length; i++) {
        let f = [];
        const p = path.resolve(srcArr[i]);
        if (isDirectory(p)) {
          f = glob.sync(`${p}/**/*.{md,markdown}`, { ignore: excludeFiles });
        } else if (isFile(p)) {
          f = glob.sync(`${p}`, { ignore: excludeFiles });
        }

        files.push(...f);
      }
      resolve(files);
    }, 0);
  });
};

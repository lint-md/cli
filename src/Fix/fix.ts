import * as path from 'path';
import * as fs from 'fs';
import { fix as runFix } from 'lint-md';

/**
 * 使用 ast 和规则进行 fix
 *
 * @param filePath 文件路径
 * @param config 配置
 * @returns {Promise<boolean>} 是否是一个有效的 fix (文件发生了变动)
 */
export const fix = (filePath: string, config) => {
  const { rules } = config;
  return new Promise((resolve) => {
    const file = path.resolve(filePath);
    const markdown = fs.readFileSync(file, { encoding: 'utf8' });
    // 修复之后的 markdown
    const newMarkdown = runFix(markdown, rules);

    // 如果不相同，那么保存回去
    if (newMarkdown !== markdown) {
      fs.writeFileSync(file, newMarkdown, { encoding: 'utf8' });
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

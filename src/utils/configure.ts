import * as fs from "fs";
import { availableParallelism } from "os";
import * as path from "path";
import chalk from "chalk";
import type { CLIConfig, ThreadCount } from "../types";
import { parseSize } from "./parse-size";

export const getLintConfig = (configFilePath?: string): Required<CLIConfig> => {
  if (configFilePath && !fs.existsSync(configFilePath)) {
    console.log(
      chalk.red(`lint-md: Configure file '${configFilePath}' is not exist.`)
    );
    process.exit(1);
  }

  let config: CLIConfig;

  const configPath = path.resolve(configFilePath || "./.lintmdrc");

  // 如果不存在文件直接返回空对象
  if (!fs.existsSync(configPath)) {
    config = {};
  } else {
    try {
      config = JSON.parse(fs.readFileSync(configPath).toString());
    } catch (e) {
      console.log(
        chalk.red(`[lint-md] Configure file '${configPath}' is invalid.`)
      );
      console.log(e);
      process.exit(1);
    }
  }

  return {
    excludeFiles: ["**/node_modules/**", "**/.git/**"],
    rules: {},
    extensions: [".md", ".markdown", ".mdx"],
    ...config,
  };
};

export const getThreadCount = (
  threadCount?: string | number | boolean
): ThreadCount => {
  if (threadCount === "auto") {
    return "auto";
  }

  // 只接受 number 或 string，其他（undefined / boolean）视为未指定
  if (typeof threadCount !== "number" && typeof threadCount !== "string") {
    return availableParallelism();
  }

  // 字符串必须是十进制正整数（拒绝 0x10、1e3、010 等）
  if (typeof threadCount === "string" && !/^[1-9]\d*$/.test(threadCount)) {
    console.error(chalk.red("[lint-md] --threads must be a positive integer."));
    process.exit(1);
  }

  const num = Number(threadCount);

  if (!Number.isInteger(num) || num <= 0) {
    console.error(chalk.red("[lint-md] --threads must be a positive integer."));
    process.exit(1);
  }

  return num;
};

// Resolves the optional --max-file-size CLI flag into a byte limit.
// Returns null when the flag is not provided (no filtering, backward
// compatible). Invalid input exits 1 with a stderr message, matching the
// --threads validation style.
export const getMaxFileSizeOption = (
  maxFileSize?: string | boolean
): number | null => {
  if (maxFileSize === undefined || typeof maxFileSize !== "string") {
    return null;
  }

  try {
    return parseSize(maxFileSize);
  } catch {
    console.error(
      chalk.red(
        "[lint-md] --max-file-size must be a valid size (e.g. 5mb, 500kb, 1gb)."
      )
    );
    process.exit(1);
  }
};

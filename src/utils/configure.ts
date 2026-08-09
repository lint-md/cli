import * as fs from "fs";
import { availableParallelism } from "os";
import * as path from "path";
import { CliError } from "../cli/cli-error";
import type { CLIConfig, ThreadCount } from "../types";
import { parseSize } from "./parse-size";

export const getLintConfig = (configFilePath?: string): Required<CLIConfig> => {
  if (configFilePath && !fs.existsSync(configFilePath)) {
    throw new CliError(
      "CONFIG_NOT_FOUND",
      `lint-md: Configure file '${configFilePath}' is not exist.`
    );
  }

  let config: CLIConfig;

  const configPath = path.resolve(configFilePath || "./.lintmdrc");

  if (!fs.existsSync(configPath)) {
    config = {};
  } else {
    try {
      config = JSON.parse(fs.readFileSync(configPath).toString());
    } catch (error) {
      throw new CliError(
        "CONFIG_INVALID",
        `[lint-md] Configure file '${configPath}' is invalid.`,
        error
      );
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

  if (typeof threadCount !== "number" && typeof threadCount !== "string") {
    return availableParallelism();
  }

  if (typeof threadCount === "string" && !/^[1-9]\d*$/.test(threadCount)) {
    throw new CliError(
      "INVALID_THREADS",
      "[lint-md] --threads must be a positive integer."
    );
  }

  const num = Number(threadCount);

  if (!Number.isInteger(num) || num <= 0) {
    throw new CliError(
      "INVALID_THREADS",
      "[lint-md] --threads must be a positive integer."
    );
  }

  return num;
};

export const getMaxFileSizeOption = (
  maxFileSize?: string | boolean
): number | null => {
  if (maxFileSize === undefined || typeof maxFileSize !== "string") {
    return null;
  }

  try {
    return parseSize(maxFileSize);
  } catch {
    throw new CliError(
      "INVALID_MAX_FILE_SIZE",
      "[lint-md] --max-file-size must be a valid size (e.g. 5mb, 500kb, 1gb)."
    );
  }
};

import * as fs from "fs";
import { availableParallelism } from "os";
import * as path from "path";
import { CliError } from "../cli/cli-error";
import type { CLIConfig, ThreadCount } from "../types";
import { parseSize } from "./parse-size";

const collectStringArrayErrors = (field: string, value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [`"${field}" must be an array of strings.`];
  }

  return value
    .map((item, index) =>
      typeof item === "string" ? null : `"${field}[${index}]" must be a string.`
    )
    .filter((message): message is string => message !== null);
};

// Validates only fields owned by the CLI. Rule existence and rule option
// schemas stay in @lint-md/core.
export const validateConfigShape = (
  value: unknown,
  configPath: string
): CLIConfig => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CliError(
      "CONFIG_INVALID",
      `[lint-md] Configure file '${configPath}' is invalid.`,
      "The configuration root must be a JSON object."
    );
  }

  const config = value as Record<string, unknown>;
  const errors: string[] = [];

  if (config.excludeFiles !== undefined) {
    errors.push(
      ...collectStringArrayErrors("excludeFiles", config.excludeFiles)
    );
  }

  if (config.extensions !== undefined) {
    errors.push(...collectStringArrayErrors("extensions", config.extensions));
  }

  if (
    config.rules !== undefined &&
    (typeof config.rules !== "object" ||
      config.rules === null ||
      Array.isArray(config.rules))
  ) {
    errors.push('"rules" must be an object.');
  }

  if (errors.length > 0) {
    throw new CliError(
      "CONFIG_INVALID",
      `[lint-md] Configure file '${configPath}' is invalid.`,
      errors.join("\n")
    );
  }

  return config as CLIConfig;
};

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
    let parsedConfig: unknown;

    try {
      parsedConfig = JSON.parse(fs.readFileSync(configPath).toString());
    } catch (error) {
      throw new CliError(
        "CONFIG_INVALID",
        `[lint-md] Configure file '${configPath}' is invalid.`,
        error
      );
    }

    config = validateConfigShape(parsedConfig, configPath);
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

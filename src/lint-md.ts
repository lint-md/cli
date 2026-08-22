#!/usr/bin/env node

import * as process from "process";

const setExitCode = (code: number): void => {
  (globalThis as { process?: NodeJS.Process }).process!.exitCode = code;
};
import { readFileSync } from "fs";
import { Command } from "commander";
import { version } from "../package.json";
import { CliError, formatCliError } from "./cli/cli-error";
import { runFileLint, runStdinLint } from "./cli/run-lint";
import {
  getLintConfig,
  getMaxFileSizeOption,
  getThreadCount,
} from "./utils/configure";
import type { ThreadCount } from "./types";

interface CLIOptions {
  fix?: boolean;
  dev?: boolean;
  config?: string;
  suppressWarnings: boolean;
  threads?: string | boolean;
  stdin?: boolean;
  maxFileSize?: string;
}

export const createProgram = (): Command => {
  const program = new Command();

  program
    .version(
      version,
      "-v, --version",
      "output the version number（查看当前版本）"
    )
    .usage("<lint-md> [files...]")
    .description("lint your markdown files")
    .option(
      "-c, --config <configure-file>",
      "use the configure file, default .lintmdrc（使用配置文件，默认为 .lintmdrc）"
    )
    .option("-f, --fix", "fix the errors automatically（开启修复模式）")
    .option("-d, --dev", "open dev mode（开启开发者模式）")
    .option(
      "-t, --threads [thread-count]",
      'Number of worker threads, or "auto" to cap concurrency for large files. Default: CPU count.（执行 Lint / Fix 的线程数，传 "auto" 时根据文件大小自适应）'
    )
    .option(
      "-s, --suppress-warnings",
      "do not let warnings affect the exit code（忽略 warning 对退出码的影响）"
    )
    .option(
      "-i, --stdin",
      "read markdown content from stdin（从标准输入中读取内容）"
    )
    .option(
      "--max-file-size <size>",
      "skip Markdown files larger than <size> (e.g. 5mb, 500kb, 1gb), warn to stderr（跳过超过指定大小的 Markdown 文件）"
    )
    .arguments("[files...]")
    .action(async (files: string[], options: CLIOptions) => {
      const {
        fix,
        config,
        threads,
        dev,
        suppressWarnings,
        stdin,
        maxFileSize,
      } = options;

      const startTime = Date.now();
      const isFixMode = Boolean(fix);
      const isDev = Boolean(dev);

      // No input at all: show help before touching config, threads, or
      // stdin. A broken .lintmdrc must not turn bare "lint-md" into a
      // config error.
      if (!files.length && !stdin) {
        program.help();
      }

      // Fail before touching stdin or the file list so neither input mode
      // starts on a command that mixes both.
      if (stdin && files.length > 0) {
        throw new CliError(
          "CONFLICTING_INPUT",
          "[lint-md] --stdin cannot be used with file arguments."
        );
      }

      // --threads and --max-file-size only affect file linting. Reject them
      // here instead of silently accepting options that would do nothing.
      const conflictingOptions = [
        [threads !== undefined, "--threads"],
        [maxFileSize !== undefined, "--max-file-size"],
      ]
        .filter(([present]) => present)
        .map(([, name]) => name);

      if (stdin && conflictingOptions.length === 1) {
        throw new CliError(
          "CONFLICTING_INPUT",
          `[lint-md] ${conflictingOptions[0]} cannot be used with --stdin.`
        );
      }

      if (stdin && conflictingOptions.length > 1) {
        throw new CliError(
          "CONFLICTING_INPUT",
          `[lint-md] The following options cannot be used with --stdin:\n${conflictingOptions.join(
            "\n"
          )}`
        );
      }

      if (isDev) {
        console.log(`dev -- version: ${version}, ${new Date().toString()}`);
      }

      const { rules, excludeFiles, extensions } = getLintConfig(config);

      const threadCount: ThreadCount = getThreadCount(threads);

      const maxFileSizeBytes = getMaxFileSizeOption(maxFileSize);

      if (stdin) {
        const content = readFileSync(process.stdin.fd, "utf8");
        const outcome = runStdinLint({
          content,
          isDev,
          isFixMode,
          rules,
          startTime,
          suppressWarnings,
        });
        setExitCode(outcome.exitCode);
        return;
      }

      const outcome = await runFileLint({
        excludeFiles,
        extensions,
        files,
        isDev,
        isFixMode,
        maxFileSizeBytes,
        rules,
        startTime,
        suppressWarnings,
        threadCount,
      });
      setExitCode(outcome.exitCode);
    });

  return program;
};

export const main = async (argv: string[] = process.argv): Promise<void> => {
  const program = createProgram();
  await program.parseAsync(argv);
};

export const runCli = (argv: string[] = process.argv): void => {
  void main(argv).catch((error) => {
    if (error instanceof CliError) {
      for (const output of formatCliError(error)) {
        console.error(output);
      }
    } else {
      console.error(error);
    }

    setExitCode(1);
  });
};

if (require.main === module) {
  runCli();
}

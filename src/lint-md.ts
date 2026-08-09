#!/usr/bin/env node

import * as process from "process";

const setExitCode = (code: number): void => {
  (globalThis as { process?: NodeJS.Process }).process!.exitCode = code;
};
import { readFileSync } from "fs";
import { Command } from "commander";
import { version } from "../package.json";
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
      "suppress all warnings, that means warnings will not block CI（抑制所有警告，这意味着警告不会阻止 CI）"
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

      if (isDev) {
        console.log(`dev -- version: ${version}, ${new Date().toString()}`);
      }

      const { rules, excludeFiles, extensions } = getLintConfig(config);

      // --threads 参数校验，所有分支共用
      const threadCount: ThreadCount = getThreadCount(threads);

      // --max-file-size 校验（未传 = null = 不过滤），失败早退，与 --threads 一致
      const maxFileSizeBytes = getMaxFileSizeOption(maxFileSize);

      // Handle stdin mode
      if (stdin) {
        const content = readFileSync(process.stdin.fd, "utf8");
        runStdinLint({
          content,
          isDev,
          isFixMode,
          rules,
          startTime,
          suppressWarnings,
        });
        return;
      }

      await runFileLint({
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
    });

  return program;
};

export const main = async (argv: string[] = process.argv): Promise<void> => {
  const program = createProgram();
  await program.parseAsync(argv);

  const isStdin = argv.includes("--stdin") || argv.includes("-i");
  if (!program.args.length && !isStdin) {
    program.help();
  }
};

export const runCli = (argv: string[] = process.argv): void => {
  void main(argv).catch((error) => {
    console.error(error);
    setExitCode(1);
  });
};

if (require.main === module) {
  runCli();
}

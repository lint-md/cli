import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { cpus, tmpdir } from "os";
import * as path from "path";
import { CliError } from "../src/cli/cli-error";
import {
  getLintConfig,
  getMaxFileSizeOption,
  getThreadCount,
} from "../src/utils/configure";

const captureCliError = (run: () => unknown): CliError => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    return error as CliError;
  }

  throw new Error("Expected a CliError.");
};

describe("configuration validation", () => {
  let tmpDir: string;
  let consoleErrorSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-config-"));
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    exitSpy = jest.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit: ${code}`);
    }) as never);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("throws a structured error for a missing configuration file", () => {
    const configPath = path.join(tmpDir, "missing.json");
    const error = captureCliError(() => getLintConfig(configPath));

    expect(error).toMatchObject({
      code: "CONFIG_NOT_FOUND",
      message: `lint-md: Configure file '${configPath}' is not exist.`,
    });
    expect(error.detail).toBeUndefined();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test("keeps the JSON parse error for an invalid configuration file", () => {
    const configPath = path.join(tmpDir, "invalid.json");
    writeFileSync(configPath, "{ invalid", "utf8");

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error).toMatchObject({
      code: "CONFIG_INVALID",
      message: `[lint-md] Configure file '${configPath}' is invalid.`,
    });
    expect(error.detail).toBeInstanceOf(SyntaxError);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test.each([
    ["a string", '"lint-md"'],
    ["an array", "[1, 2]"],
    ["a number", "42"],
    ["null", "null"],
  ])("rejects a configuration whose root is %s", (_, content) => {
    const configPath = path.join(tmpDir, "root.json");
    writeFileSync(configPath, content, "utf8");

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error).toMatchObject({
      code: "CONFIG_INVALID",
      message: `[lint-md] Configure file '${configPath}' is invalid.`,
    });
    expect(error.detail).toBe("The configuration root must be a JSON object.");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test("rejects a non-array excludeFiles", () => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(
      configPath,
      JSON.stringify({ excludeFiles: "node_modules" }),
      "utf8"
    );

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.detail).toContain(
      '"excludeFiles" must be an array of strings.'
    );
  });

  test("rejects a non-string element inside excludeFiles", () => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(
      configPath,
      JSON.stringify({ excludeFiles: ["**/node_modules/**", 42] }),
      "utf8"
    );

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.detail).toContain('"excludeFiles[1]" must be a string.');
  });

  test("rejects a non-array extensions", () => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(configPath, JSON.stringify({ extensions: ".md" }), "utf8");

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.detail).toContain('"extensions" must be an array of strings.');
  });

  test.each([
    ["an array", []],
    ["a string", "strict"],
    ["null", null],
  ])("rejects rules that are %s", (_, rules) => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(configPath, JSON.stringify({ rules }), "utf8");

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.detail).toContain('"rules" must be an object.');
  });

  test("reports all shape errors in one error", () => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(
      configPath,
      JSON.stringify({
        excludeFiles: "node_modules",
        extensions: ".md",
        rules: [],
      }),
      "utf8"
    );

    const error = captureCliError(() => getLintConfig(configPath));

    expect(error.detail).toBe(
      [
        '"excludeFiles" must be an array of strings.',
        '"extensions" must be an array of strings.',
        '"rules" must be an object.',
      ].join("\n")
    );
  });

  test("accepts a well-shaped configuration and keeps defaults for absent fields", () => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(
      configPath,
      JSON.stringify({ excludeFiles: ["dist/**"], extensions: [".md"] }),
      "utf8"
    );

    expect(getLintConfig(configPath)).toEqual({
      excludeFiles: ["dist/**"],
      extensions: [".md"],
      rules: {},
    });
  });

  test("uses the CPU count when threads are not specified", () => {
    expect(getThreadCount(undefined)).toBe(cpus().length);
    expect(getThreadCount(false)).toBe(cpus().length);
    expect(getThreadCount(true)).toBe(cpus().length);
  });

  test("accepts positive integer thread counts", () => {
    expect(getThreadCount(2)).toBe(2);
    expect(getThreadCount("1")).toBe(1);
    expect(getThreadCount("4")).toBe(4);
  });

  test('accepts "auto" as the thread count', () => {
    expect(getThreadCount("auto")).toBe("auto");
  });

  test.each([0, -1, "0", "-1", "abc", "1.5", "0x10", "1e3"])(
    "throws a structured error for invalid threads: %p",
    (threadCount) => {
      const error = captureCliError(() => getThreadCount(threadCount));

      expect(error).toMatchObject({
        code: "INVALID_THREADS",
        message: "[lint-md] --threads must be a positive integer.",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    }
  );

  test("throws a structured error for an invalid maximum file size", () => {
    const error = captureCliError(() => getMaxFileSizeOption("1.5mb"));

    expect(error).toMatchObject({
      code: "INVALID_MAX_FILE_SIZE",
      message:
        "[lint-md] --max-file-size must be a valid size (e.g. 5mb, 500kb, 1gb).",
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

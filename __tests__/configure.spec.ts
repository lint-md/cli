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

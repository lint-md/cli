describe("cli tests", () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    jest.dontMock("../src/utils/load-md-files");
    jest.dontMock("../src/cli/run-lint");
    jest.restoreAllMocks();
  });

  test("importing the CLI does not parse arguments or exit", () => {
    process.argv = ["node", "lint-md", "--help"];
    const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    let cli!: typeof import("../src/lint-md");
    expect(() => {
      cli = require("../src/lint-md");
    }).not.toThrow();

    expect(cli.createProgram).toEqual(expect.any(Function));
    expect(cli.main).toEqual(expect.any(Function));
    expect(mockExit).not.toHaveBeenCalled();
  });

  test("createProgram returns independent program instances", () => {
    const { createProgram } = require("../src/lint-md");

    const first = createProgram();
    const second = createProgram();

    expect(first).not.toBe(second);
    expect(first.options.map(({ long }: { long: string }) => long)).toEqual([
      "--version",
      "--config",
      "--fix",
      "--dev",
      "--threads",
      "--suppress-warnings",
      "--stdin",
      "--max-file-size",
    ]);
  });

  test("main waits for asynchronous actions", async () => {
    let resolveFiles!: (files: string[]) => void;
    const files = new Promise<string[]>((resolve) => {
      resolveFiles = resolve;
    });
    const loadMdFiles = jest.fn(() => files);
    jest.doMock("../src/utils/load-md-files", () => ({ loadMdFiles }));
    const mockExit = jest
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    jest.spyOn(console, "log").mockImplementation();
    const { main } = require("../src/lint-md");
    process.exitCode = undefined;

    let settled = false;
    const result = main(["node", "lint-md", "fixture.md"]).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveFiles([]);
    await result;

    expect(settled).toBe(true);
    expect(loadMdFiles).toHaveBeenCalledTimes(1);
    expect(mockExit).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });

  test("main applies the lint outcome at the CLI boundary", async () => {
    const runFileLint = jest.fn().mockResolvedValue({ exitCode: 1 });
    jest.doMock("../src/cli/run-lint", () => ({
      runFileLint,
      runStdinLint: jest.fn(),
    }));
    const { main } = require("../src/lint-md");
    process.exitCode = undefined;

    await main(["node", "lint-md", "fixture.md"]);

    expect(runFileLint).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });

  test("runCli handles rejected actions", async () => {
    const error = new Error("load failed");
    const loadMdFiles = jest.fn(() => Promise.reject(error));
    jest.doMock("../src/utils/load-md-files", () => ({ loadMdFiles }));
    const mockError = jest.spyOn(console, "error").mockImplementation();
    const { runCli } = require("../src/lint-md");

    process.exitCode = undefined;
    runCli(["node", "lint-md", "fixture.md"]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockError).toHaveBeenCalledWith(error);
    expect(process.exitCode).toBe(1);
  });

  test("main shows help when no input is provided", async () => {
    const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const { main } = require("../src/lint-md");

    await expect(main(["node", "lint-md"])).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test("skips lint setup when no input is provided", async () => {
    const getLintConfig = jest.fn();
    jest.doMock("../src/utils/configure", () => ({ getLintConfig }));
    const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const { main } = require("../src/lint-md");

    await expect(main(["node", "lint-md"])).rejects.toThrow("process.exit");

    expect(getLintConfig).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test("rejects file arguments combined with --stdin", async () => {
    const runFileLint = jest.fn().mockResolvedValue({ exitCode: 0 });
    const runStdinLint = jest.fn().mockReturnValue({ exitCode: 0 });
    jest.doMock("../src/cli/run-lint", () => ({
      runFileLint,
      runStdinLint,
    }));
    const mockError = jest.spyOn(console, "error").mockImplementation();
    const { runCli } = require("../src/lint-md");

    process.exitCode = undefined;
    runCli(["node", "lint-md", "fixture.md", "--stdin"]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining(
        "[lint-md] --stdin cannot be used with file arguments."
      )
    );
    expect(runStdinLint).not.toHaveBeenCalled();
    expect(runFileLint).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("rejects the -i short form combined with file arguments", async () => {
    const runFileLint = jest.fn().mockResolvedValue({ exitCode: 0 });
    const runStdinLint = jest.fn().mockReturnValue({ exitCode: 0 });
    jest.doMock("../src/cli/run-lint", () => ({
      runFileLint,
      runStdinLint,
    }));
    const mockError = jest.spyOn(console, "error").mockImplementation();
    const { runCli } = require("../src/lint-md");

    process.exitCode = undefined;
    runCli(["node", "lint-md", "-i", "fixture.md"]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(runStdinLint).not.toHaveBeenCalled();
    expect(runFileLint).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("rejects --threads combined with --stdin before validating its value", async () => {
    const runFileLint = jest.fn().mockResolvedValue({ exitCode: 0 });
    const runStdinLint = jest.fn().mockReturnValue({ exitCode: 0 });
    jest.doMock("../src/cli/run-lint", () => ({
      runFileLint,
      runStdinLint,
    }));
    const mockError = jest.spyOn(console, "error").mockImplementation();
    const { runCli } = require("../src/lint-md");

    process.exitCode = undefined;
    runCli(["node", "lint-md", "--stdin", "--threads", "abc"]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining(
        "[lint-md] --threads cannot be used with --stdin."
      )
    );
    expect(mockError).not.toHaveBeenCalledWith(
      expect.stringContaining("INVALID_THREADS")
    );
    expect(runStdinLint).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("rejects --max-file-size combined with --stdin", async () => {
    const runFileLint = jest.fn().mockResolvedValue({ exitCode: 0 });
    const runStdinLint = jest.fn().mockReturnValue({ exitCode: 0 });
    jest.doMock("../src/cli/run-lint", () => ({
      runFileLint,
      runStdinLint,
    }));
    const mockError = jest.spyOn(console, "error").mockImplementation();
    const { runCli } = require("../src/lint-md");

    process.exitCode = undefined;
    runCli(["node", "lint-md", "--stdin", "--max-file-size", "5mb"]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining(
        "[lint-md] --max-file-size cannot be used with --stdin."
      )
    );
    expect(runStdinLint).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("aggregates all file-only options rejected with --stdin", async () => {
    const runFileLint = jest.fn().mockResolvedValue({ exitCode: 0 });
    const runStdinLint = jest.fn().mockReturnValue({ exitCode: 0 });
    jest.doMock("../src/cli/run-lint", () => ({
      runFileLint,
      runStdinLint,
    }));
    const mockError = jest.spyOn(console, "error").mockImplementation();
    const { runCli } = require("../src/lint-md");

    process.exitCode = undefined;
    runCli([
      "node",
      "lint-md",
      "--stdin",
      "--threads",
      "4",
      "--max-file-size",
      "5mb",
    ]);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining(
        "[lint-md] The following options cannot be used with --stdin:\n--threads\n--max-file-size"
      )
    );
    expect(runStdinLint).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});

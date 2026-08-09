import * as lintCore from "@lint-md/core";
import { runStdinLint } from "../src/cli/run-lint";

describe("runStdinLint", () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  test("passes whitespace through unchanged in fix mode", () => {
    const write = jest
      .spyOn(process.stdout, "write")
      .mockImplementation((() => true) as never);

    const outcome = runStdinLint({
      content: "   \n\n",
      isDev: false,
      isFixMode: true,
      rules: {},
      startTime: 0,
      suppressWarnings: false,
    });

    expect(write).toHaveBeenCalledWith("   \n\n");
    expect(outcome).toEqual({ exitCode: 0 });
  });

  test("returns success when lint input has no content", () => {
    const error = jest.spyOn(console, "error").mockImplementation();
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    const outcome = runStdinLint({
      content: " \n",
      isDev: false,
      isFixMode: false,
      rules: {},
      startTime: 0,
      suppressWarnings: false,
    });

    expect(error).toHaveBeenCalledWith("No content to lint");
    expect(exit).not.toHaveBeenCalled();
    expect(outcome).toEqual({ exitCode: 0 });
  });

  test("reports timing after a clean lint", () => {
    const log = jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(Date, "now").mockReturnValue(125);

    const outcome = runStdinLint({
      content: "# Hello\n",
      isDev: false,
      isFixMode: false,
      rules: {},
      startTime: 100,
      suppressWarnings: false,
    });

    expect(log).toHaveBeenCalledWith("");
    expect(log).toHaveBeenCalledWith("⌛️Done in 25ms.");
    expect(outcome).toEqual({ exitCode: 0 });
  });

  test("reports rule failures to stderr and returns failure without timing", () => {
    jest.spyOn(lintCore, "lintMarkdown").mockReturnValue({
      lintResult: [],
      fixedResult: null,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      executionErrors: [
        {
          ruleName: "broken-rule",
          message: "rule threw",
          round: 1,
          phase: "create",
        },
      ],
    } as any);
    const stdout = jest.spyOn(console, "log").mockImplementation();
    const stderr = jest.spyOn(console, "error").mockImplementation();
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    process.exitCode = undefined;

    const outcome = runStdinLint({
      content: "# Hello\n",
      isDev: false,
      isFixMode: false,
      rules: {},
      startTime: 100,
      suppressWarnings: true,
    });

    expect(stdout).toHaveBeenCalledWith("");
    expect(stderr).toHaveBeenCalledWith(
      "[lint-md] (stdin): broken-rule failed in create (round 1): rule threw"
    );
    expect(stdout.mock.invocationCallOrder[0]).toBeLessThan(
      stderr.mock.invocationCallOrder[0]
    );
    expect(stdout).not.toHaveBeenCalledWith(expect.stringContaining("Done in"));
    expect(exit).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(outcome).toEqual({ exitCode: 1 });
  });

  test("keeps fix output pipe-safe when a rule fails", () => {
    jest.spyOn(lintCore, "fixMarkdown").mockReturnValue({
      lintResult: [],
      fixedResult: null,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      executionErrors: [
        {
          ruleName: "broken-rule",
          message: "rule threw",
          round: 1,
          phase: "fix",
        },
      ],
    } as any);
    const stdout = jest
      .spyOn(process.stdout, "write")
      .mockImplementation((() => true) as never);
    const stderr = jest.spyOn(console, "error").mockImplementation();
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    process.exitCode = undefined;

    const outcome = runStdinLint({
      content: "# Original\n",
      isDev: false,
      isFixMode: true,
      rules: {},
      startTime: 100,
      suppressWarnings: true,
    });

    expect(stdout).toHaveBeenCalledWith("# Original\n");
    expect(stderr).toHaveBeenCalledWith(
      "[lint-md] (stdin): broken-rule failed in fix (round 1): rule threw"
    );
    expect(stdout.mock.invocationCallOrder[0]).toBeLessThan(
      stderr.mock.invocationCallOrder[0]
    );
    expect(exit).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(outcome).toEqual({ exitCode: 1 });
  });
});

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

    runStdinLint({
      content: "   \n\n",
      isDev: false,
      isFixMode: true,
      rules: {},
      startTime: 0,
      suppressWarnings: false,
    });

    expect(write).toHaveBeenCalledWith("   \n\n");
  });

  test("exits successfully when lint input has no content", () => {
    const error = jest.spyOn(console, "error").mockImplementation();
    const exit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    expect(() =>
      runStdinLint({
        content: " \n",
        isDev: false,
        isFixMode: false,
        rules: {},
        startTime: 0,
        suppressWarnings: false,
      })
    ).toThrow("process.exit");

    expect(error).toHaveBeenCalledWith("No content to lint");
    expect(exit).toHaveBeenCalledWith(0);
  });

  test("reports timing after a clean lint", () => {
    const log = jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(Date, "now").mockReturnValue(125);

    runStdinLint({
      content: "# Hello\n",
      isDev: false,
      isFixMode: false,
      rules: {},
      startTime: 100,
      suppressWarnings: false,
    });

    expect(log).toHaveBeenCalledWith("");
    expect(log).toHaveBeenCalledWith("⌛️Done in 25ms.");
  });
});

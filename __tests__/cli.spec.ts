describe("cli tests", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
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

  test("main shows help when no input is provided", () => {
    const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const { main } = require("../src/lint-md");

    expect(() => main(["node", "lint-md"])).toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});

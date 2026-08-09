describe("cli tests", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.dontMock("../src/utils/load-md-files");
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
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test("main shows help when no input is provided", async () => {
    const mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const { main } = require("../src/lint-md");

    await expect(main(["node", "lint-md"])).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});

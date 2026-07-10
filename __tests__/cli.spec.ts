describe("cli tests", () => {
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    process.argv = [];
    jest.resetModules();
    mockExit = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  test("if user does not pass any argument, process.exit is called", () => {
    expect(() => require("../src/lint-md")).toThrow("process.exit");
    expect(mockExit).toHaveBeenCalled();
  });
});

import { formatBytes, parseSize } from "../src/utils/parse-size";

describe("parseSize", () => {
  test("parses kb/m/g units case-insensitively", () => {
    expect(parseSize("500kb")).toBe(500 * 1024);
    expect(parseSize("1mb")).toBe(1024 * 1024);
    expect(parseSize("5mb")).toBe(5 * 1024 * 1024);
    expect(parseSize("1gb")).toBe(1024 * 1024 * 1024);
    expect(parseSize("5MB")).toBe(5 * 1024 * 1024);
    expect(parseSize("1GB")).toBe(1024 * 1024 * 1024);
    expect(parseSize("5b")).toBe(5);
    expect(parseSize("5k")).toBe(5 * 1024);
  });

  test("rejects invalid input", () => {
    expect(() => parseSize("1.5mb")).toThrow();
    expect(() => parseSize("1 mb")).toThrow();
    expect(() => parseSize("0")).toThrow();
    expect(() => parseSize("-1")).toThrow();
    expect(() => parseSize("abc")).toThrow();
    expect(() => parseSize("")).toThrow();
    expect(() => parseSize("10x")).toThrow();
  });

  test("rejects malformed-but-permissible-looking units", () => {
    expect(() => parseSize("kk")).toThrow();
    expect(() => parseSize("mbb")).toThrow();
    expect(() => parseSize("kbk")).toThrow();
  });
});

describe("formatBytes", () => {
  test("uses dynamic units with one decimal and drops trailing .0", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MiB");
    expect(formatBytes(Math.round(8.3 * 1024 * 1024))).toBe("8.3 MiB");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1 KiB");
    expect(formatBytes(200 * 1024)).toBe("200 KiB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GiB");
  });
});

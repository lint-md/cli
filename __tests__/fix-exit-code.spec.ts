import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

const TSX = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const CLI = path.resolve(__dirname, "../src/lint-md.ts");
const FIXABLE = path.resolve(__dirname, "../examples/space-around.md");
const UNFIXABLE = "```js\n12345678901234567890\n```\n";

describe.each(["file", "stdin"] as const)("--fix exit code with %s", (mode) => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-fix-exit-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const runFix = (
    content: string,
    severity?: number,
    suppressWarnings = false
  ) => {
    const configPath = path.join(tmpDir, ".lintmdrc");
    const filePath = path.join(tmpDir, "test.md");
    const rules =
      severity === undefined
        ? {}
        : { "no-long-code": [severity, { length: 10, exclude: [] }] };
    writeFileSync(configPath, JSON.stringify({ rules }));
    writeFileSync(filePath, content);

    const args = [TSX, CLI, "--fix", "--config", configPath];
    if (mode === "stdin") {
      args.push("--stdin");
    } else {
      args.push(filePath);
    }
    if (suppressWarnings) {
      args.push("--suppress-warnings");
    }

    const result = spawnSync(process.execPath, args, {
      cwd: tmpDir,
      input: mode === "stdin" ? content : undefined,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return { ...result, fileContent: readFileSync(filePath, "utf8") };
  };

  test("fails when an error remains", () => {
    const result = runFix(UNFIXABLE, 2, true);
    const source = mode === "stdin" ? "(stdin)" : path.join(tmpDir, "test.md");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `[lint-md] ${source}: Fix completed with 1 error(s) and 0 warning(s) remaining.`
    );
    if (mode === "stdin") {
      expect(result.stdout).toBe(UNFIXABLE);
    }
  });

  test.each([
    [false, 1],
    [true, 0],
  ])("uses warning suppression %s for remaining warnings", (suppress, exit) => {
    const result = runFix(UNFIXABLE, 1, suppress);
    const source = mode === "stdin" ? "(stdin)" : path.join(tmpDir, "test.md");

    expect(result.status).toBe(exit);
    expect(result.stderr).toContain(
      `[lint-md] ${source}: Fix completed with 0 error(s) and 1 warning(s) remaining.`
    );
    if (mode === "stdin") {
      expect(result.stdout).toBe(UNFIXABLE);
    }
  });

  test("succeeds when fixes clear the initial errors", () => {
    const input = readFileSync(FIXABLE, "utf8");
    const result = runFix(input);

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("Fix completed with");
    if (mode === "stdin") {
      expect(result.stdout).not.toContain("Done in");
      expect(result.stdout).not.toBe(input);
    } else {
      expect(result.fileContent).not.toBe(input);
    }
  });
});

import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

const TSX = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const CLI = path.resolve(__dirname, "../src/lint-md.ts");

describe("core rule configuration errors", () => {
  let tmpDir: string;

  const writeConfig = (rules: Record<string, unknown>) => {
    writeFileSync(
      path.join(tmpDir, ".lintmdrc"),
      JSON.stringify({ rules }),
      "utf8"
    );
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-invalid-rule-"));
    writeConfig({ "unknown-rule": 2 });
    writeFileSync(path.join(tmpDir, "fixture.md"), "# Title\n", "utf8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const runCli = (args: string[], input?: string) => {
    try {
      execFileSync(process.execPath, [TSX, CLI, ...args], {
        cwd: tmpDir,
        encoding: "utf8",
        input,
        stdio: ["pipe", "pipe", "pipe"],
      });
      throw new Error("CLI should exit with status 1");
    } catch (error: any) {
      return {
        status: error.status,
        stderr: error.stderr ?? "",
      };
    }
  };

  test.each([
    ["stdin lint", ["--stdin"], "# Title\n"],
    ["stdin fix", ["--stdin", "--fix"], "# Title\n"],
    ["worker batch lint", ["fixture.md"], undefined],
  ])(
    "%s prints a configuration diagnostic without a stack",
    (_, args, input) => {
      const { status, stderr } = runCli(args as string[], input as string);

      expect(status).toBe(1);
      expect(stderr).toContain("[lint-md] Configuration error: unknown rule");
      expect(stderr).not.toMatch(/^\s*at\s/m);
      expect(stderr).not.toContain("TypeError:");
    }
  );

  test("formats a multiline unknown rule name without a stack", () => {
    writeConfig({ "evil\n\r\u001B[31mred\u001B[0m\u001B]spoof\u0007name": 2 });

    const { status, stderr } = runCli(["fixture.md"]);

    expect(status).toBe(1);
    expect(stderr).toContain('unknown rule "evil^J^Mredname"');
    expect(stderr).not.toMatch(/^\s*at\s/m);
    expect(stderr).not.toContain("TypeError:");
  });

  test("formats the duplicate-alias error thrown by core", () => {
    writeConfig({
      "alias-a": [{ meta: { name: "duplicate-name" } }, 2, {}],
      "alias-b": [{ meta: { name: "duplicate-name" } }, 2, {}],
    });

    const { status, stderr } = runCli(["fixture.md"]);

    expect(status).toBe(1);
    expect(stderr).toContain('duplicate rule alias "duplicate-name"');
    expect(stderr).toContain("your lint-md configuration file");
    expect(stderr).not.toMatch(/^\s*at\s/m);
    expect(stderr).not.toContain("TypeError:");
  });
});

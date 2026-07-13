import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

const TSX = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const CLI = path.resolve(__dirname, "../src/lint-md.ts");

describe("core rule configuration errors", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-invalid-rule-"));
    writeFileSync(
      path.join(tmpDir, ".lintmdrc"),
      JSON.stringify({ rules: { "unknown-rule": 2 } }),
      "utf8"
    );
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
});

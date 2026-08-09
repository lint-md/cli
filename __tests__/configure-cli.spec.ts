import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

const TSX = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const CLI = path.resolve(__dirname, "../src/lint-md.ts");

describe("configuration diagnostics", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-config-cli-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const runStdinFix = (configPath: string) =>
    spawnSync(
      process.execPath,
      [TSX, CLI, "--stdin", "--fix", "--config", configPath],
      {
        encoding: "utf8",
        input: "# Hello\n",
      }
    );

  test("requires a path after --config", () => {
    const result = spawnSync(process.execPath, [TSX, CLI, "--config"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--config <configure-file>");
    expect(result.stderr).toContain("argument missing");
  });

  test("writes a missing configuration error only to stderr", () => {
    const result = runStdinFix(path.join(tmpDir, "missing.json"));

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Configure file");
    expect(result.stderr).toContain("missing.json");
  });

  test("writes an invalid configuration error only to stderr", () => {
    const configPath = path.join(tmpDir, "invalid.json");
    writeFileSync(configPath, "{ invalid", "utf8");

    const result = runStdinFix(configPath);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Configure file");
    expect(result.stderr).toContain("invalid.json");
    expect(result.stderr).toContain("is invalid");
  });
});

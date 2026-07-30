import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

const TSX = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const CLI = path.resolve(__dirname, "../src/lint-md.ts");

describe("core 2.3 rules", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-core-2-3-"));
    configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(
      configPath,
      JSON.stringify({
        rules: {
          "require-trailing-spaces": 2,
          "space-around-link": 2,
          "no-multiple-blank-lines": 2,
        },
      }),
      "utf8"
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("applies all opt-in rules through stdin fix mode", () => {
    const stdout = execFileSync(
      process.execPath,
      [TSX, CLI, "--stdin", "--fix", "--config", configPath],
      {
        input: "甲[链接](https://example.com)乙\n第二行\n\n\n末行\n",
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    expect(stdout).toBe(
      "甲 [链接](https://example.com) 乙  \n第二行\n\n末行\n"
    );
  });
});

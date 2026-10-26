import { spawnSync } from "child_process";
import { fixMarkdown } from "@lint-md/core";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import * as path from "path";
import lintWorker from "../src/utils/lint-worker";

const CLI = path.resolve(__dirname, "../lib/src/lint-md.js");
const TSX = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const SOURCE_CLI = path.resolve(__dirname, "../src/lint-md.ts");
const RULES = { "space-around-alphabet": 2 };
const MDX = [
  'import Widget from "中文English";',
  "",
  'export const title = "中文English";',
  "",
  '<Widget label="中文English" count={"中文English"} />',
  "",
  '{"中文English"}',
  "",
  "<Widget>正文English内容。</Widget>",
  "",
].join("\n");
const FIXED_MDX = MDX.replace(
  "<Widget>正文English内容。</Widget>",
  "<Widget>正文 English 内容。</Widget>"
);

describe("MDX lint", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "lint-md-mdx-"));
    configPath = path.join(tmpDir, ".lintmdrc");
    writeFileSync(configPath, JSON.stringify({ rules: RULES }), "utf8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("lints Markdown text", async () => {
    const filePath = path.join(tmpDir, "document.md");
    writeFileSync(filePath, "正文English内容。\n", "utf8");

    const result = await lintWorker({
      filePath,
      rules: RULES,
      isFixMode: false,
    });

    expect(result.diagnostics).toHaveLength(2);
    expect(
      result.diagnostics.map(({ ruleId, line }) => [ruleId, line])
    ).toEqual([
      ["space-around-alphabet", 1],
      ["space-around-alphabet", 1],
    ]);
  });

  test.each([".mdx", ".MDX"])(
    "lints %s through the CLI and skips JSX, ESM, and expressions",
    (extension) => {
      const filePath = path.join(tmpDir, `document${extension}`);
      writeFileSync(filePath, MDX, "utf8");

      const result = spawnSync(
        process.execPath,
        [CLI, filePath, "--config", configPath],
        { encoding: "utf8" }
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(filePath);
      expect(result.stdout).toContain("9:10");
      expect(result.stdout).toContain("9:17");
      expect(result.stdout).toContain("2 problems");
    }
  );

  test("fixes MDX through the worker and preserves ESM, JSX, and expressions", async () => {
    const filePath = path.join(tmpDir, "document.mdx");
    writeFileSync(filePath, MDX, "utf8");

    const result = await lintWorker({
      filePath,
      rules: RULES,
      isFixMode: true,
    });

    expect(result.changed).toBe(true);
    expect(result.fixedResult?.result).toBe(FIXED_MDX);
    expect(result.remainingSummary).toEqual({
      errorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
    });
    expect(FIXED_MDX).toContain('import Widget from "中文English";');
    expect(FIXED_MDX).toContain('export const title = "中文English";');
    expect(FIXED_MDX).toContain(
      '<Widget label="中文English" count={"中文English"} />'
    );
    expect(FIXED_MDX).toContain('{"中文English"}');
  });

  test.each([".mdx", ".MDX"])(
    "fixes %s in a mixed batch and exits 0",
    (extension) => {
      const markdownPath = path.join(tmpDir, "document.md");
      const mdxPath = path.join(tmpDir, `document${extension}`);
      writeFileSync(markdownPath, "正文English内容。\n", "utf8");
      writeFileSync(mdxPath, MDX, "utf8");

      const result = spawnSync(
        process.execPath,
        [CLI, markdownPath, mdxPath, "--fix", "--config", configPath],
        { encoding: "utf8" }
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("does not support .mdx");
      expect(readFileSync(markdownPath, "utf8")).toBe("正文 English 内容。\n");
      expect(readFileSync(mdxPath, "utf8")).toBe(FIXED_MDX);
    }
  );

  test("fixing MDX is idempotent", async () => {
    const filePath = path.join(tmpDir, "document.mdx");
    writeFileSync(filePath, MDX, "utf8");

    const first = spawnSync(
      process.execPath,
      [CLI, filePath, "--fix", "--config", configPath],
      { encoding: "utf8" }
    );
    const afterFirst = readFileSync(filePath, "utf8");

    const second = spawnSync(
      process.execPath,
      [CLI, filePath, "--fix", "--config", configPath],
      { encoding: "utf8" }
    );

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(afterFirst).toBe(FIXED_MDX);
    expect(readFileSync(filePath, "utf8")).toBe(afterFirst);
    expect(second.stderr).not.toContain("Fix completed with");
  });

  test("fixed MDX still compiles", () => {
    const filePath = path.join(tmpDir, "document.mdx");
    writeFileSync(filePath, MDX, "utf8");

    const result = spawnSync(
      process.execPath,
      [CLI, filePath, "--fix", "--config", configPath],
      { encoding: "utf8" }
    );
    // @mdx-js/mdx is ESM-only. Compile in a child process because Jest runs
    // CommonJS without VM modules.
    const compileScript = [
      'import { compile } from "@mdx-js/mdx";',
      'import { readFileSync } from "node:fs";',
      "const source = readFileSync(process.env.MDX_FILE, 'utf8');",
      "const compiled = await compile(source);",
      "process.stdout.write(compiled.value.length > 0 ? 'ok' : 'empty');",
    ].join("\n");
    const compiled = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", compileScript],
      {
        encoding: "utf8",
        env: { ...process.env, MDX_FILE: filePath },
      }
    );

    expect(result.status).toBe(0);
    expect(compiled.status).toBe(0);
    expect(compiled.stdout).toBe("ok");
  });

  test("does not rewrite an unchanged MDX file", () => {
    const filePath = path.join(tmpDir, "document.mdx");
    const content = "```js\n12345678901234567890\n```\n";
    const oldTime = new Date("2000-01-01T00:00:00.000Z");
    writeFileSync(filePath, content, "utf8");
    utimesSync(filePath, oldTime, oldTime);
    writeFileSync(
      configPath,
      JSON.stringify({
        rules: { "no-long-code": [2, { length: 10, exclude: [] }] },
      }),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      [CLI, filePath, "--fix", "--config", configPath],
      { encoding: "utf8" }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Fix completed with 1 error(s)");
    expect(readFileSync(filePath, "utf8")).toBe(content);
    expect(statSync(filePath).mtimeMs).toBe(oldTime.getTime());
  });

  test("stdin without a file extension keeps Markdown behavior", () => {
    const content =
      'export const title = "中文English";\n\n正文English内容。\n';

    const result = spawnSync(
      process.execPath,
      [TSX, SOURCE_CLI, "--stdin", "--fix", "--config", configPath],
      { input: content, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      fixMarkdown(content, { rules: RULES }).fixedResult?.result
    );
    expect(result.stdout).toBe(
      'export const title = "中文 English";\n\n正文 English 内容。\n'
    );
  });
});

import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import lintWorker from "../src/utils/lint-worker";

const CLI = path.resolve(__dirname, "../lib/src/lint-md.js");
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
    "lints MDX text and skips JSX, ESM, and expressions in %s files",
    async (extension) => {
      const filePath = path.join(tmpDir, `document${extension}`);
      writeFileSync(filePath, MDX, "utf8");

      const result = await lintWorker({
        filePath,
        rules: RULES,
        isFixMode: false,
      });

      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.map(({ ruleId, line }) => [ruleId, line])
      ).toEqual([
        ["space-around-alphabet", 9],
        ["space-around-alphabet", 9],
      ]);
    }
  );

  test("routes Markdown and MDX through the CLI", () => {
    const markdownPath = path.join(tmpDir, "document.md");
    const mdxPath = path.join(tmpDir, "document.mdx");
    writeFileSync(markdownPath, "正文English内容。\n", "utf8");
    writeFileSync(mdxPath, MDX, "utf8");

    const result = spawnSync(
      process.execPath,
      [CLI, markdownPath, mdxPath, "--config", configPath],
      { encoding: "utf8" }
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(markdownPath);
    expect(result.stdout).toContain(mdxPath);
    expect(result.stdout).toContain("4 problems");
  });

  test("rejects a direct worker fix request for MDX", async () => {
    const filePath = path.join(tmpDir, "document.mdx");
    writeFileSync(filePath, MDX, "utf8");

    await expect(
      lintWorker({ filePath, rules: RULES, isFixMode: true })
    ).rejects.toThrow("--fix does not support .mdx files");
    expect(readFileSync(filePath, "utf8")).toBe(MDX);
  });

  test("rejects MDX fix requests before changing any file", () => {
    const markdownPath = path.join(tmpDir, "document.md");
    const mdxPath = path.join(tmpDir, "document.mdx");
    const markdown = "正文English内容。\n";
    writeFileSync(markdownPath, markdown, "utf8");
    writeFileSync(mdxPath, MDX, "utf8");

    const result = spawnSync(
      process.execPath,
      [CLI, markdownPath, mdxPath, "--fix", "--config", configPath],
      { encoding: "utf8" }
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "--fix does not support .mdx files. No files were changed."
    );
    expect(readFileSync(markdownPath, "utf8")).toBe(markdown);
    expect(readFileSync(mdxPath, "utf8")).toBe(MDX);
  });
});

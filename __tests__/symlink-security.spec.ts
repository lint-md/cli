import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { safeWriteFile } from "../src/utils/safe-write-file";
import { loadMdFiles } from "../src/utils/load-md-files";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-md-symlink-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("symlink security", () => {
  test("safeWriteFile writes to regular file", async () => {
    const filePath = path.join(tmpDir, "normal.md");
    fs.writeFileSync(filePath, "# old");

    await safeWriteFile(filePath, "# new");

    expect(fs.readFileSync(filePath, "utf8")).toBe("# new");
  });

  test("loadMdFiles includes normal .md files", async () => {
    const filePath = path.join(tmpDir, "normal.md");
    fs.writeFileSync(filePath, "# normal");

    const result = await loadMdFiles([path.join(tmpDir, "*.md")], []);

    expect(result).toContain(filePath);
  });

  test("loadMdFiles filters .md symlinks", async () => {
    const realFile = path.join(tmpDir, "real.md");
    const symlinkFile = path.join(tmpDir, "link.md");
    fs.writeFileSync(realFile, "# real");
    fs.symlinkSync(realFile, symlinkFile);

    const result = await loadMdFiles([path.join(tmpDir, "*.md")], []);

    expect(result).toContain(realFile);
    expect(result).not.toContain(symlinkFile);
  });

  test("loadMdFiles does not filter files inside symlinked directories", async () => {
    const realDir = path.join(tmpDir, "real");
    const linkDir = path.join(tmpDir, "link");
    fs.mkdirSync(realDir);
    fs.writeFileSync(path.join(realDir, "a.md"), "# a");
    fs.symlinkSync(realDir, linkDir, "dir");

    const result = await loadMdFiles([path.join(tmpDir, "**", "*.md")], []);

    const realResult = path.join(realDir, "a.md");
    const linkResult = path.join(linkDir, "a.md");
    expect(result).toContain(realResult);
    expect(result).toContain(linkResult);
    // Note: safeWriteFile rejects a symlink as the final path component,
    // but it does not prevent traversal through symlinked parent directories.
    // This test documents the current loadMdFiles behavior.
  });

  test("loadMdFiles deduplicates overlapping patterns", async () => {
    const filePath = path.join(tmpDir, "dup.md");
    fs.writeFileSync(filePath, "# dup");

    const result = await loadMdFiles(
      [path.join(tmpDir, "*.md"), path.join(tmpDir, "*.md")],
      []
    );

    expect(result).toHaveLength(1);
    expect(result).toContain(filePath);
  });

  test("loadMdFiles returns absolute paths for relative patterns", async () => {
    const filePath = path.join(tmpDir, "rel.md");
    fs.writeFileSync(filePath, "# rel");

    const cwd = process.cwd();
    const relativePattern = path.relative(cwd, path.join(tmpDir, "*.md"));

    const result = await loadMdFiles([relativePattern], []);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(path.isAbsolute(result[0])).toBe(true);
  });

  test("loadMdFiles handles nonexistent paths gracefully", async () => {
    const result = await loadMdFiles([path.join(tmpDir, "no-such-*.md")], []);

    expect(result).toEqual([]);
  });

  test("loadMdFiles respects extensions filter", async () => {
    fs.writeFileSync(path.join(tmpDir, "a.md"), "# a");
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "text");

    const result = await loadMdFiles([path.join(tmpDir, "*")], [], [".md"]);

    expect(result).toContain(path.join(tmpDir, "a.md"));
    expect(result).not.toContain(path.join(tmpDir, "b.txt"));
  });

  test("safeWriteFile rejects symlink", async () => {
    const target = path.join(tmpDir, "target.md");
    const symlink = path.join(tmpDir, "link.md");
    fs.writeFileSync(target, "# target");
    fs.symlinkSync(target, symlink);

    await expect(safeWriteFile(symlink, "# hacked")).rejects.toThrow(
      /ELOOP|ENOENT/
    );
  });

  test("safeWriteFile rejects file replaced with symlink after scan", async () => {
    const filePath = path.join(tmpDir, "file.md");
    const target = path.join(tmpDir, "target.md");
    fs.writeFileSync(filePath, "# original");
    fs.writeFileSync(target, "# target");

    // Simulate TOCTOU: scan sees regular file, then attacker replaces with symlink
    const stat = fs.lstatSync(filePath);
    expect(stat.isFile()).toBe(true);

    // Replace with symlink
    fs.unlinkSync(filePath);
    fs.symlinkSync(target, filePath);

    await expect(safeWriteFile(filePath, "# hacked")).rejects.toThrow(
      /ELOOP|ENOENT/
    );
  });

  test("safeWriteFile preserves original file mode", async () => {
    const filePath = path.join(tmpDir, "mode-test.md");
    fs.writeFileSync(filePath, "# old");
    fs.chmodSync(filePath, 0o666);

    await safeWriteFile(filePath, "# new");

    const mode = fs.statSync(filePath).mode & 0o777;
    expect(mode).toBe(0o666);
    expect(fs.readFileSync(filePath, "utf8")).toBe("# new");
  });

  test("safeWriteFile truncates old tail when new content is shorter", async () => {
    const filePath = path.join(tmpDir, "shorter.md");
    fs.writeFileSync(filePath, "# old content with tail");

    await safeWriteFile(filePath, "# new");

    expect(fs.readFileSync(filePath, "utf8")).toBe("# new");
  });
});

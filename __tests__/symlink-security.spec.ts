import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { safeWriteFile } from '../src/utils/safe-write-file';
import { loadMdFiles } from '../src/utils/load-md-files';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-md-symlink-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('symlink security', () => {
  test('safeWriteFile writes to regular file', async () => {
    const filePath = path.join(tmpDir, 'normal.md');
    fs.writeFileSync(filePath, '# old');

    await safeWriteFile(filePath, '# new');

    expect(fs.readFileSync(filePath, 'utf8')).toBe('# new');
  });

  test('loadMdFiles filters .md symlinks', async () => {
    const realFile = path.join(tmpDir, 'real.md');
    const symlinkFile = path.join(tmpDir, 'link.md');
    fs.writeFileSync(realFile, '# real');
    fs.symlinkSync(realFile, symlinkFile);

    const result = await loadMdFiles([path.join(tmpDir, '*.md')], []);

    expect(result).toContain(realFile);
    expect(result).not.toContain(symlinkFile);
  });

  test('safeWriteFile rejects symlink', async () => {
    const target = path.join(tmpDir, 'target.md');
    const symlink = path.join(tmpDir, 'link.md');
    fs.writeFileSync(target, '# target');
    fs.symlinkSync(target, symlink);

    await expect(safeWriteFile(symlink, '# hacked'))
      .rejects.toThrow(/ELOOP|ENOENT/);
  });

  test('safeWriteFile rejects file replaced with symlink after scan', async () => {
    const filePath = path.join(tmpDir, 'file.md');
    const target = path.join(tmpDir, 'target.md');
    fs.writeFileSync(filePath, '# original');
    fs.writeFileSync(target, '# target');

    // Simulate TOCTOU: scan sees regular file, then attacker replaces with symlink
    const stat = fs.lstatSync(filePath);
    expect(stat.isFile()).toBe(true);

    // Replace with symlink
    fs.unlinkSync(filePath);
    fs.symlinkSync(target, filePath);

    await expect(safeWriteFile(filePath, '# hacked'))
      .rejects.toThrow(/ELOOP|ENOENT/);
  });

  test('safeWriteFile preserves original file mode', async () => {
    const filePath = path.join(tmpDir, 'mode-test.md');
    fs.writeFileSync(filePath, '# old');
    fs.chmodSync(filePath, 0o666);

    await safeWriteFile(filePath, '# new');

    const mode = fs.statSync(filePath).mode & 0o777;
    expect(mode).toBe(0o666);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('# new');
  });

  test('safeWriteFile truncates old tail when new content is shorter', async () => {
    const filePath = path.join(tmpDir, 'shorter.md');
    fs.writeFileSync(filePath, '# old content with tail');

    await safeWriteFile(filePath, '# new');

    expect(fs.readFileSync(filePath, 'utf8')).toBe('# new');
  });
});

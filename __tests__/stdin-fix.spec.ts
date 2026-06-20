import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const CLI = path.resolve(__dirname, '../src/lint-md.ts');
const EXAMPLE = path.resolve(__dirname, '../examples/space-around.md');

describe('--stdin --fix output', () => {
  test('stdout only contains fixed markdown, no timing info', () => {
    const input = fs.readFileSync(EXAMPLE, 'utf8');
    const tmpFile = path.join(os.tmpdir(), `lint-md-test-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, input);

    try {
      const result = execSync(
        `cat ${tmpFile} | npx tsx ${CLI} --stdin --fix`,
        { stdio: 'pipe' },
      );
      const stdout = result.toString();
      expect(stdout).not.toContain('Done in');
      expect(stdout).not.toContain('⌛️');
    }
    finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

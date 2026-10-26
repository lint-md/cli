import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "lint-md-package-"));

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}\n${result.stderr}`
    );
  }

  return result.stdout;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

try {
  const packOutput = run("npm", [
    "pack",
    "--json",
    // The outer `npm publish --dry-run` propagates npm_config_dry_run into
    // this script; force a real tarball for the local smoke test.
    "--dry-run=false",
    "--pack-destination",
    temporaryDirectory,
  ]);
  const [packedPackage] = JSON.parse(packOutput);
  const packedFiles = new Set(packedPackage.files.map(({ path }) => path));

  for (const expectedFile of [
    "CHANGELOG.md",
    "lib/src/lint-md.js",
    "lib/src/utils/lint-worker.js",
  ]) {
    assert(packedFiles.has(expectedFile), `tarball is missing ${expectedFile}`);
  }

  const tarball = join(temporaryDirectory, basename(packedPackage.filename));
  assert(existsSync(tarball), `npm pack did not create ${tarball}`);

  const installPrefix = join(temporaryDirectory, "installed");
  run("npm", [
    "install",
    "--global",
    "--prefix",
    installPrefix,
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    // Same npm_config_dry_run propagation; force a real installation.
    "--dry-run=false",
    tarball,
  ]);

  const lintMd = join(installPrefix, "bin", "lint-md");
  assert(existsSync(lintMd), "global installation did not expose lint-md");
  run(lintMd, ["--version"]);

  const cleanMarkdown = "# Hello\n\nThis is clean.\n";
  run(lintMd, ["--stdin"], { input: cleanMarkdown });

  const fixtureDirectory = join(temporaryDirectory, "fixtures");
  const cleanFile = join(fixtureDirectory, "clean.md");
  const cleanMdxFile = join(fixtureDirectory, "clean.mdx");
  const fixableFile = join(fixtureDirectory, "fixable.md");
  const fixableMdxFile = join(fixtureDirectory, "fixable.mdx");
  const configFile = join(fixtureDirectory, ".lintmdrc");
  mkdirSync(fixtureDirectory);
  cpSync(join(projectRoot, "examples", "space-around.md"), fixableFile, {
    recursive: false,
  });
  writeFileSync(cleanFile, cleanMarkdown, "utf8");
  writeFileSync(cleanMdxFile, '# Hello\n\n<Card label="text" />\n', "utf8");
  writeFileSync(
    configFile,
    JSON.stringify({ rules: { "space-around-alphabet": 2 } }),
    "utf8"
  );
  const originalMdxContent = [
    'export const title = "中文English";',
    "",
    '<Card label="中文English">',
    "  正文English内容。",
    "</Card>",
    "",
  ].join("\n");
  writeFileSync(fixableMdxFile, originalMdxContent, "utf8");

  run(lintMd, [cleanFile]);
  run(lintMd, [cleanMdxFile]);
  const originalFixableContent = readFileSync(fixableFile, "utf8");
  run(lintMd, [fixableFile, "--fix"]);
  const fixedContent = readFileSync(fixableFile, "utf8");
  assert(fixedContent !== originalFixableContent, "--fix did not update the fixture");
  run(lintMd, [fixableFile]);

  run(lintMd, [fixableMdxFile, "--fix", "--config", configFile]);
  const fixedMdxContent = readFileSync(fixableMdxFile, "utf8");
  assert(
    fixedMdxContent.includes('export const title = "中文English";'),
    "installed --fix changed an ESM string"
  );
  assert(
    fixedMdxContent.includes('<Card label="中文English">'),
    "installed --fix changed a JSX attribute"
  );
  assert(
    fixedMdxContent.includes("正文 English 内容。"),
    "installed --fix did not fix MDX body text"
  );
  assert(
    fixedMdxContent !== originalMdxContent,
    "installed --fix did not update the MDX fixture"
  );
  run(lintMd, [fixableMdxFile, "--config", configFile]);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

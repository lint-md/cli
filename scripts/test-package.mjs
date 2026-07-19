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
    "--pack-destination",
    temporaryDirectory,
  ]);
  const [packedPackage] = JSON.parse(packOutput);
  const packedFiles = new Set(packedPackage.files.map(({ path }) => path));

  for (const expectedFile of [
    "CHANGELOG.md",
    "lib/src/lint-md.js",
    "lib/src/utils/lint-worker.js",
    "esm/src/lint-md.js",
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
    tarball,
  ]);

  const lintMd = join(installPrefix, "bin", "lint-md");
  assert(existsSync(lintMd), "global installation did not expose lint-md");
  run(lintMd, ["--version"]);

  const cleanMarkdown = "# Hello\n\nThis is clean.\n";
  run(lintMd, ["--stdin"], { input: cleanMarkdown });

  const fixtureDirectory = join(temporaryDirectory, "fixtures");
  const cleanFile = join(fixtureDirectory, "clean.md");
  const fixableFile = join(fixtureDirectory, "fixable.md");
  mkdirSync(fixtureDirectory);
  cpSync(join(projectRoot, "examples", "space-around.md"), fixableFile, {
    recursive: false,
  });
  writeFileSync(cleanFile, cleanMarkdown, "utf8");

  run(lintMd, [cleanFile]);
  const originalFixableContent = readFileSync(fixableFile, "utf8");
  run(lintMd, [fixableFile, "--fix"]);
  const fixedContent = readFileSync(fixableFile, "utf8");
  assert(fixedContent !== originalFixableContent, "--fix did not update the fixture");
  run(lintMd, [fixableFile]);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

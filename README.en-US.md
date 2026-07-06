# @lint-md/cli

English | [简体中文](./README.md)

[![build](https://github.com/lint-md/cli/actions/workflows/build.yml/badge.svg)](https://github.com/lint-md/cli/actions/workflows/build.yml)
[![docker](https://github.com/lint-md/cli/actions/workflows/docker.yml/badge.svg)](https://github.com/lint-md/cli/actions/workflows/docker.yml)

`@lint-md/cli` is the command-line interface for [Lint Markdown](https://github.com/lint-md/lint-md). It checks and fixes formatting issues in Chinese Markdown documents.

## Project Scope

- Target users: Chinese technical documentation, blogs, knowledge bases, and other Markdown content.
- Core capabilities: batch scanning, rule validation, automatic fixes with `--fix`, and CI failure gates.
- Runtime model: this package provides the CLI, while the rule engine is provided by `@lint-md/core`.

## Upstream And Downstream

- **Upstream dependency**: [`@lint-md/core`](https://github.com/lint-md/lint-md/tree/master/packages/core), which provides rule definitions and lint/fix capabilities.
- **This repository**: handles argument parsing, file collection, parallel execution, result summaries, and exit code control.
- **Downstream users**: documentation repositories, writing pipelines, and CI/CD workflows such as GitHub Actions that invoke `lint-md`.

## Installation

```bash
npm i -D @lint-md/cli
```

Or install it globally:

```bash
npm i -g @lint-md/cli
```

## Quick Start

```bash
# Check a single file
lint-md README.md

# Check all Markdown files in a directory
lint-md "docs/**/*.md"

# Apply automatic fixes
lint-md "docs/**/*.md" --fix
```

## Docker Usage

Build the image first:

```bash
docker build -t lint-md .
```

Run a read-only check:

```bash
docker run --rm \
  -v "$PWD:/work:ro" \
  -w /work \
  lint-md "docs/**/*.md"
```

When running `--fix` against a mounted directory, pass the current user explicitly to avoid writing host files as the container user:

```bash
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "$PWD:/work" \
  -w /work \
  lint-md "docs/**/*.md" --fix
```

The image runs as a non-root user by default. If the mounted directory has strict permissions, `--user` is the most reliable option.

## Common Options

- `-c, --config [configure-file]`: use a configuration file, defaults to `./.lintmdrc`
- `-f, --fix`: automatically fix fixable issues
- `-t, --threads [thread-count]`: set the number of worker threads
- `-s, --suppress-warnings`: ignore warnings when deciding the exit code, which helps with gradual CI adoption
- `-i, --stdin`: read Markdown content from standard input
- `-d, --dev`: enable development debug mode
- `-v, --version`: print the current version

## Configuration Example (`.lintmdrc`)

```json
{
  "excludeFiles": ["**/node_modules/**", "**/.git/**"],
  "extensions": [".md", ".markdown", ".mdx"],
  "rules": {
    "no-empty-code": true
  }
}
```

### Configuration Fields

| Field          | Type       | Default                                | Description                                                           |
| -------------- | ---------- | -------------------------------------- | --------------------------------------------------------------------- |
| `excludeFiles` | `string[]` | `["**/node_modules/**", "**/.git/**"]` | File glob patterns to exclude                                         |
| `extensions`   | `string[]` | `[".md", ".markdown", ".mdx"]`         | File extensions to lint                                               |
| `rules`        | `object`   | `{}`                                   | Rule configuration. See the `@lint-md/core` documentation for details |

## Exit Codes

- `0`: no errors were found, or only warnings were found while `--suppress-warnings` is enabled
- `1`: errors were found, or warnings were found while `--suppress-warnings` is not enabled

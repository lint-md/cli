# Changelog

## [2.1.0](https://github.com/lint-md/cli/compare/v2.0.0...v2.1.0) (2026-06-30)

### Features

- **lint-md:** add `--stdin` flag for reading markdown from standard input ([#35](https://github.com/lint-md/cli/issues/35))
- **lint-md:** add `--fix` write concurrency limit using `runTasksWithLimit`, prevent memory spike on large batches ([#55](https://github.com/lint-md/cli/issues/55))
- **load-md-files:** make file extensions configurable via `--ext` option ([#37](https://github.com/lint-md/cli/issues/37))
- add `.mdx` file support ([#22](https://github.com/lint-md/cli/issues/22))
- **lint-md:** dynamically calculate thread group count to utilize multi-core CPUs ([#26](https://github.com/lint-md/cli/issues/26))

### Bug Fixes

- **lint-md:** move `getThreadCount` validation before all branches, add stderr output for invalid threads
- **batch-lint:** limit `readFile` concurrency to match thread count
- **configure:** validate `--threads` parameter as positive integer
- preserve whitespace-only stdin in fix mode
- stdin fix clean input handling, thread count regex validation, help text alignment
- **lint-md:** skip timing output in stdin fix mode to prevent stdout pollution
- error handling, null guard, and configure type annotation fixes ([#39](https://github.com/lint-md/cli/issues/39))
- **build:** correct bin path from `lib/lint-md.js` to `lib/src/lint-md.js`
- **build:** multi-stage Dockerfile with pinned Node 22 LTS ([#45](https://github.com/lint-md/cli/issues/45))

### Performance

- **batch-lint:** process files in batches to reduce memory usage

### Refactoring

- **lint-md:** rewrite stdin path for readability, separate empty string vs whitespace-only stdin check
- **batch-lint:** rename `limitConcurrency` to `runTasksWithLimit`, reduce nesting
- **configure:** improve `getThreadCount` readability with type guard
- TypeScript type annotation fixes and tsconfig cleanup ([#35](https://github.com/lint-md/cli/issues/35))
- remove `lodash`, `fs-extra` redundant dependencies ([#24](https://github.com/lint-md/cli/issues/24))

### Tests

- add `getThreadCount` unit tests, `runTasksWithLimit` concurrency/order tests, stdin fix content tests
- **cli:** fix worker crash by mocking `process.exit` instead of programmatic exit
- **configure:** add number 0 and -1 to invalid threads test.each
- use `test.each` for invalid threads and `execFileSync` for stdin fix
- add `modulePathIgnorePatterns` to suppress haste collision warning ([#53](https://github.com/lint-md/cli/issues/53))

### Dependencies

- upgrade `glob` from ^8.0.3 to ^13.0.6 ([#43](https://github.com/lint-md/cli/issues/43))
- upgrade `piscina` from 3.2.0 to 5.1.4 ([#32](https://github.com/lint-md/cli/issues/32))
- replace `rimraf` with `rm - -rf`, move `eslint-config` to devDependencies, upgrade `jest` to ^30 ([#51](https://github.com/lint-md/cli/issues/51))

### CI/CD

- add Docker smoke test workflow ([#45](https://github.com/lint-md/cli/issues/45))
- add Node.js version matrix (20/22/24) and setup-node step ([#30](https://github.com/lint-md/cli/issues/30))
- add GitHub Actions CI badges to README ([#47](https://github.com/lint-md/cli/issues/47))

### Documentation

- rewrite README with clear positioning, dependents, and usage ([#25](https://github.com/lint-md/cli/issues/25))
- add Docker usage guide with `--fix` volume permission tip

## [2.0.0](https://github.com/lint-md/cli/compare/v0.1.8...v2.0.0) (2023-07-12)

- use `@lint-md/core` 2.0.0 ([#18](https://github.com/lint-md/cli/issues/18))

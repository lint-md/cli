# Changelog

## [2.3.1](https://github.com/lint-md/cli/compare/v2.3.0...v2.3.1) (2026-09-01)

### Performance Improvements

- use safe auto worker limits by default ([#184](https://github.com/lint-md/cli/pull/184))
- reuse file stats for filtering and concurrency ([#182](https://github.com/lint-md/cli/pull/182))

### Bug Fixes

- stop scheduling after failure ([#181](https://github.com/lint-md/cli/pull/181))

## [2.3.0](https://github.com/lint-md/cli/compare/v2.2.5...v2.3.0) (2026-08-22)

### Features

- validate CLI configuration shape ([#146](https://github.com/lint-md/cli/pull/146))
- reject unknown configuration fields ([#164](https://github.com/lint-md/cli/pull/164))

### Bug Fixes

- make lint result ordering deterministic ([#148](https://github.com/lint-md/cli/pull/148))
- clarify empty file discovery output ([#152](https://github.com/lint-md/cli/pull/152))
- reject file arguments with `--stdin` ([#166](https://github.com/lint-md/cli/pull/166))
- avoid lint setup when no input is provided ([#168](https://github.com/lint-md/cli/pull/168))
- reject file-only options with `--stdin` ([#170](https://github.com/lint-md/cli/pull/170))
- clarify the `--suppress-warnings` help text ([#172](https://github.com/lint-md/cli/pull/172))

### Refactoring

- enable `noImplicitAny` ([#162](https://github.com/lint-md/cli/pull/162))

### Tests

- make CLI error assertions ANSI-safe ([#176](https://github.com/lint-md/cli/pull/176))
- run the package smoke test during `npm publish --dry-run` ([#178](https://github.com/lint-md/cli/pull/178))

### Tooling

- align ts-jest with Jest 30 support ([#154](https://github.com/lint-md/cli/pull/154))
- upgrade TypeScript from `^4.8.4` to `^6.0.3` in two steps ([#156](https://github.com/lint-md/cli/pull/156), [#160](https://github.com/lint-md/cli/pull/160))
- modernize the tsconfig to NodeNext resolution ([#158](https://github.com/lint-md/cli/pull/158))

### Documentation

- sync CLI options with current behavior ([#150](https://github.com/lint-md/cli/pull/150))

### CI/CD

- release on version tags ([#144](https://github.com/lint-md/cli/pull/144))

## [2.2.5](https://github.com/lint-md/cli/compare/v2.2.4...v2.2.5) (2026-08-10)

### Bug Fixes

- define the CLI-only package contract ([#115](https://github.com/lint-md/cli/pull/115))
- build the Docker image without a lockfile ([#116](https://github.com/lint-md/cli/pull/116))
- await asynchronous CLI actions ([#120](https://github.com/lint-md/cli/pull/120))
- write configuration errors to stderr ([#129](https://github.com/lint-md/cli/pull/129))
- require a configuration path ([#130](https://github.com/lint-md/cli/pull/130))

### Dependencies

- upgrade `@lint-md/core` from `^2.3.0` to `^2.3.1`

### Refactoring

- separate CLI startup ([#119](https://github.com/lint-md/cli/pull/119))
- remove unsupported library type exports ([#122](https://github.com/lint-md/cli/pull/122))
- reuse adaptive concurrency diagnostics ([#124](https://github.com/lint-md/cli/pull/124))
- extract stdin lint flow ([#126](https://github.com/lint-md/cli/pull/126))
- extract file lint flow ([#128](https://github.com/lint-md/cli/pull/128))
- make configuration validation side-effect free ([#132](https://github.com/lint-md/cli/pull/132))
- centralize lint failure decisions ([#133](https://github.com/lint-md/cli/pull/133))
- centralize diagnostics and exit handling ([#134](https://github.com/lint-md/cli/pull/134))
- separate concurrency and file-size policies ([#136](https://github.com/lint-md/cli/pull/136))
- centralize core result adaptation ([#138](https://github.com/lint-md/cli/pull/138))
- separate lint summary from terminal rendering ([#140](https://github.com/lint-md/cli/pull/140))

### CI/CD

- run Docker smoke tests on related pull requests ([#117](https://github.com/lint-md/cli/pull/117))

## [2.2.4](https://github.com/lint-md/cli/compare/v2.2.3...v2.2.4) (2026-07-30)

### Dependencies

- upgrade `@lint-md/core` from `^2.2.1` to `^2.3.0`

### Documentation

- document Core 2.3 opt-in rules in both README files

### Tests

- add a CLI regression test for the Core 2.3 opt-in rules

### Refactoring

- use `fixMarkdown()` for CLI fix paths
- require an explicit fix mode for lint workers

## [2.2.3](https://github.com/lint-md/cli/compare/v2.2.2...v2.2.3) (2026-07-29)

### Tests

- add npm tarball smoke test for the packed CLI and installed `lint-md`, with a dedicated Node 22 CI job ([#103](https://github.com/lint-md/cli/issues/103), [#104](https://github.com/lint-md/cli/pull/104))
- update `NotAppliedFix` test fixtures for `@lint-md/core` 2.2.1 ([#109](https://github.com/lint-md/cli/pull/109))

### Dependencies

- upgrade `@lint-md/core` from `^2.1.5` to `^2.1.6` for parser 0.2.0 source-map fixes and accurate inline-code value ranges ([#104](https://github.com/lint-md/cli/pull/104))
- upgrade `@lint-md/core` from `^2.1.6` to `^2.2.1` ([#109](https://github.com/lint-md/cli/pull/109))

## [2.2.2](https://github.com/lint-md/cli/compare/v2.1.1...v2.2.2) (2026-07-13)

### Features

- **lint-md:** add `--threads auto` to cap worker concurrency for large Markdown files (issue #77, P1)
- **lint-md:** add `--max-file-size <size>` to skip large Markdown files with a stderr warning (issue #81)
- **lint-md:** surface core executionErrors and exit(1) ([#96](https://github.com/lint-md/cli/issues/96), [#101](https://github.com/lint-md/cli/pull/101))
- **lint-md:** surface fix convergence warnings (cycle/max) ([#98](https://github.com/lint-md/cli/issues/98), [#100](https://github.com/lint-md/cli/pull/100))
- **lint-md:** warn to stderr when fixes not applied ([#85](https://github.com/lint-md/cli/issues/85), [#89](https://github.com/lint-md/cli/pull/89))

### Bug Fixes

- **batch-lint:** keep files with notAppliedFixes ([#86](https://github.com/lint-md/cli/issues/86), [#90](https://github.com/lint-md/cli/pull/90))
- **get-report-data:** use real fixable counts from core ([#91](https://github.com/lint-md/cli/pull/91))
- **package.json:** pin js-yaml >=3.15.0 to resolve moderate vulnerability ([#92](https://github.com/lint-md/cli/issues/92), [#93](https://github.com/lint-md/cli/pull/93))
- format core configuration errors ([#99](https://github.com/lint-md/cli/pull/99))

### Refactoring

- **types:** reuse @lint-md/core LintReportItem / FixedResult ([#88](https://github.com/lint-md/cli/pull/88))
- replace eslint with tsc --noEmit + prettier --check ([#94](https://github.com/lint-md/cli/pull/94))
- add format script and explicit .prettierrc ([#95](https://github.com/lint-md/cli/pull/95))

## [2.1.1](https://github.com/lint-md/cli/compare/v2.0.0...v2.1.1) (2026-06-30)

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

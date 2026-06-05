# @lint-md/cli

`@lint-md/cli` 是 [Lint Markdown](https://github.com/lint-md/lint-md) 的命令行工具，用于检查和修复中文 Markdown 文档中的格式问题。

## 项目定位

- 面向对象：中文技术文档、博客、知识库等 Markdown 内容。
- 核心能力：批量扫描、规则校验、自动修复（`--fix`）、CI 失败拦截。
- 运行方式：本包提供 CLI；规则引擎由 `@lint-md/core` 提供。

## 上下游关系

- **上游（依赖）**：[`@lint-md/core`](https://github.com/lint-md/lint-md/tree/master/packages/core)（规则定义与 lint/fix 能力）。
- **当前仓库职责**：参数解析、文件收集、并行执行、结果汇总与退出码控制。
- **下游（使用方）**：文档仓库、写作流水线、CI/CD（如 GitHub Actions）中调用 `lint-md`。

## 安装

```bash
npm i -D @lint-md/cli
```

或全局安装：

```bash
npm i -g @lint-md/cli
```

## 快速开始

```bash
# 检查单个文件
lint-md README.md

# 检查目录内所有 Markdown 文件
lint-md "docs/**/*.md"

# 自动修复
lint-md "docs/**/*.md" --fix
```

## 常用参数

- `-c, --config [configure-file]`：指定配置文件（默认 `./.lintmdrc`）
- `-f, --fix`：自动修复可修复问题
- `-t, --threads [thread-count]`：设置并发线程数
- `-s, --suppress-warnings`：忽略 warning 对退出码的影响（便于 CI 渐进接入）
- `-F, --format <format>`：输出格式，可选 `default`（默认）或 `json`（机器可读）
- `-d, --dev`：开发调试模式
- `-v, --version`：查看版本

## 配置示例（`.lintmdrc`）

```json
{
  "excludeFiles": [
    "**/node_modules/**",
    "**/.git/**"
  ],
  "rules": {
    "no-empty-code": true
  }
}
```

> `rules` 的完整配置项请参考 `@lint-md/core` 文档。

## 退出码约定

- `0`：无错误（或仅 warning 且启用了 `--suppress-warnings`）
- `1`：存在错误，或存在 warning 且未启用 `--suppress-warnings`

## Vim ALE 集成

安装 `@lint-md/cli` 后，在 `.vimrc` 或 `init.vim` 中添加以下配置即可在 Vim 中实时检测 Markdown 格式问题：

```vim
function! s:lintmd_handler(bufnr, lines) abort
  let l:data = json_decode(join(a:lines, ''))
  let l:results = []
  for l:item in l:data
    for l:e in l:item.errors
      call add(l:results, {
      \ 'lnum': l:e.line,
      \ 'col': l:e.column,
      \ 'type': l:e.severity == 2 ? 'E' : 'W',
      \ 'text': l:e.message . ' [' . l:e.ruleId . ']',
      \ })
    endfor
  endfor
  return l:results
endfunction

call ale#linter#Define('markdown', {
\   'name': 'lintmd',
\   'executable': 'lint-md',
\   'command': '%e --format=json %t',
\   'callback': 's:lintmd_handler',
\})
```

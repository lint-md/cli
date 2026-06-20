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

## Docker 使用

先构建镜像：

```bash
docker build -t lint-md .
```

只读检查场景：

```bash
docker run --rm \
  -v "$PWD:/work:ro" \
  -w /work \
  lint-md "docs/**/*.md"
```

对挂载目录执行 `--fix` 时，建议显式传入当前用户，避免把宿主文件写成容器内用户的属主：

```bash
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "$PWD:/work" \
  -w /work \
  lint-md "docs/**/*.md" --fix
```

镜像默认使用非 root 用户运行；如果挂载目录权限较严格，`--user` 是最稳妥的用法。

## 常用参数

- `-c, --config [configure-file]`：指定配置文件（默认 `./.lintmdrc`）
- `-f, --fix`：自动修复可修复问题
- `-t, --threads [thread-count]`：设置并发线程数
- `-s, --suppress-warnings`：忽略 warning 对退出码的影响（便于 CI 渐进接入）
- `-i, --stdin`：从标准输入读取 Markdown 内容
- `-d, --dev`：开发调试模式
- `-v, --version`：查看版本

## 配置示例（`.lintmdrc`）

```json
{
  "excludeFiles": [
    "**/node_modules/**",
    "**/.git/**"
  ],
  "extensions": [".md", ".markdown", ".mdx"],
  "rules": {
    "no-empty-code": true
  }
}
```

### 配置项说明

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `excludeFiles` | `string[]` | `["**/node_modules/**", "**/.git/**"]` | 排除的文件 glob 模式 |
| `extensions` | `string[]` | `[".md", ".markdown", ".mdx"]` | 要 lint 的文件扩展名 |
| `rules` | `object` | `{}` | 规则配置，详见 `@lint-md/core` 文档 |

## 退出码约定

- `0`：无错误（或仅 warning 且启用了 `--suppress-warnings`）
- `1`：存在错误，或存在 warning 且未启用 `--suppress-warnings`

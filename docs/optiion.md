## lint-md/cli 改进清单

这份清单按"已完成 / 待做"维护，避免已合并事项继续留在待办里。

## 已完成

| 优先级 | 改进项 | 结果 |
| --- | --- | --- |
| P0 | 校验 `--threads` 参数 | 已要求必须是十进制正整数；非法值会报错并退出 `1` |
| P0 | 限制读取文件并发 | 已按线程数限制 `readFile` 并发，避免一次性 `Promise.all(readFile)` |
| P1 | 修复 `--stdin --fix` 输出污染 | stdin fix 模式现在只输出 markdown 内容，不再混入耗时信息 |
| P1 | `--stdin --fix` clean / whitespace 输入行为 | clean input 原样输出；whitespace-only input 也会原样透传 |
| P1 | 跨 CLI 路径的 `--threads` 校验测试 | 已覆盖 `stdin` 和"无匹配文件"场景 |
| P1 | Node 20 测试兼容性 | 测试改为使用本地 `tsx`，不再依赖运行时 `npx` 拉包 |
| P1 | Jest 忽略构建产物目录 | 在 Jest 配置中增加 `modulePathIgnorePatterns`，忽略 `esm/` 和 `lib/`，消除 haste collision warning |
| P2 | 升级 `glob` | 已升级到 v13 Promise API，移除了手写 `promisifyGlob` 包装，删除 `@types/glob` |
| P2 | 大仓库内存优化 | 已改为按 `concurrency` 分批读取 + 分批 lint，每批整批传给 worker，内存从全部驻留降到 `concurrency` 个文件 |
| P3 | Dockerfile 改进 | 已固定 Node 22 LTS、改成三阶段构建（deps → builder → runtime），runtime 使用非 root 用户 |
| P3 | Docker 构建上下文收敛 | 已通过 `.dockerignore` 和精确 `COPY` 缩小上下文，只复制构建必需文件 |
| P3 | Docker 使用文档 | README 已补充只读挂载、`--fix` 写挂载目录、`--user $(id -u):$(id -g)` 的使用说明 |
| P3 | Docker workflow 权限收敛 | Docker workflow 已加 `permissions: contents: read`，仅在 Dockerfile/package.json 变更时触发 |
| P3 | GitHub Actions CI badge | README 已展示 build 和 docker workflow 状态 |
| P3 | 替换 rimraf | `clean` 脚本改为原生 `rm -rf`，移除 rimraf 依赖 |
| P3 | 移动 eslint-config | `@attachments/eslint-config` 从 `dependencies` 移到 `devDependencies` |
| P3 | 升级 Jest 30 | jest ^29 → ^30，修复 js-yaml 中等漏洞，ts-jest 保持 v29 兼容 |
| P3 | bin 路径修复 | `lib/lint-md.js` → `lib/src/lint-md.js`，修正 tsc build 输出实际路径 |

## 待做

| 优先级 | 改进项 | 问题 | 建议方案 | 适合 PR |
| --- | --- | --- | --- | --- |
| P1 | 限制 `--fix` 写文件并发 | `Promise.all(writeFile...)` 仍然没有并发限制 | 与读取共用 I/O limit，例如 `Math.max(threads, 4)` 或单独 `ioConcurrency` | ✅ 适合 |
| P1 | `--fix` 模式增加 summary | 当前 fix 后基本没有告诉用户修了多少文件/问题 | 输出 fixed files、fixed problems、remaining problems | ✅ 适合 |
| P1 | 无文件输入时提示更清楚 | 当前无 `files` 时直接 `return`，最后靠 `program.help()` 处理；逻辑略绕 | 统一在 action 内处理空输入，输出 help 或明确提示 | ✅ 适合 |
| P2 | 配置文件支持 JSONC/YAML | 当前只支持 JSON `.lintmdrc`，注释不友好 | 支持 `.lintmdrc.json`、`.lintmdrc.jsonc`、`.lintmdrc.yaml`、`package.json` 字段 | 中等 PR |
| P2 | 报告输出支持格式化 | 当前只有终端表格 | 增加 `--format json` / `--format stylish`，方便 CI 集成 | 中等 PR |
| P3 | 发布流程补强 | GitHub 没有 Releases，发布信息不明显 | 增加 release workflow / changelog / npm provenance | 偏维护者向 |

## 下一步建议

Docker 相关收尾已经完成，下一步回到 CLI 功能和用户反馈：

1. 限制 `--fix` 写文件并发
2. `--fix` 模式增加 summary
3. 无文件输入时提示更清楚

按收益 / 改动比，我最推荐先做 **`--fix` 模式增加 summary**。这是当前最直接的用户可见改进。

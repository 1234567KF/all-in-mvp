# 极致节能规则（按需加载索引）

> 真源文件在 `ultra-cost-effective/rules/`。本文件**每次会话自动加载**，因此只保留"何时该读哪个文件"的判断依据，不复述规则正文。

## 按需读取

| 场景 | 读取 | 在 Qoder CLI 下是否可执行 |
|------|------|--------------------------|
| 任何会话的默认工具优先级、三色灯上下文管理 | `ultra-cost-effective/rules/main.md` | ✅ 行为规则，直接适用 |
| 长会话（>30 轮）或输出被截断，需要压缩策略 | `ultra-cost-effective/rules/compression-default.md` | ⚠️ 仅"手动控制"节可用 |
| 编写/复用 prompt 与技能，需 KV Cache 命中 | `ultra-cost-effective/rules/cache-optimization.md`、`shared-prefix.md` | ✅ 行为规则，直接适用 |
| 需要拦截工具输出、派发子 Agent 前压缩上下文 | `ultra-cost-effective/rules/interceptor-aop.md` | ❌ 依赖 node hooks |
| 需要 `ctx_read` / MCP 压缩工具 | `ultra-cost-effective/rules/lean-ctx.md` | ❌ 本机无 `lean-ctx` 可执行文件 |
| 流水线子 Agent 编排前的预压缩 | `ultra-cost-effective/rules/workflow-compress.md` | ⚠️ 语义仍适用，但无 Dynamic Workflow |

## 环境事实（决定上表 ⚠️/❌ 的原因）

- 本机 **未安装 Node.js**（`node` 不在 PATH）→ `ultra-cost-effective/helpers/*.cjs` 与所有 node hooks 无法运行。
- `lean-ctx` MCP 服务端可执行文件不存在 → 该 MCP 不会加载。
- Qoder CLI 不识别 `rules` 配置键：只有放在 `.qoder/rules/` 下的 `.md` 会被自动加载（故本文件存在）。

结论：节能规则中**依赖外部工具链**的部分当前失效，纯行为约束部分有效。恢复方式见 `MIGRATION-PLAN-qoder.md`。

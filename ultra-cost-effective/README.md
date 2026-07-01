# UltraCostEffective · 操作说明书

> 本文件是面向用户的详细操作指南。项目介绍请查看根目录 SKILL.md。

---

## 快速接入（两种方式任选）

### 方式一：一键脚本（推荐）

```bash
# 在 ultra-cost-effective/ 目录下执行：

# Windows PowerShell
.\install.ps1 -Preset standard

# macOS / Linux
./install.sh --standard
```

脚本自动完成全部步骤，重启 Claude Code 即可。

**可选参数：**

| 参数 | 说明 | 默认 |
|------|------|------|
| `-Preset quick/standard/extreme` | 节能预设 | standard |
| `-SkipLeanCtx` | 跳过 lean-ctx 安装 | — |
| `-SkipHeadroom` | 跳过 Headroom 安装 | — |

### 方式二：手动 3 步

#### 第 1 步：复制引擎到目标项目

```bash
cp -r ultra-cost-effective/ /path/to/your-project/
```

#### 第 2 步：合并 settings.json

将 `adapters/claude/settings.template.json` 中的以下块合并到 `.claude/settings.json`：

- `env` — 环境变量
- `hooks.PreToolUse` — 自动管道注入
- `hooks.PostToolUse` — 性能追踪 + 上下文监控
- `mcpServers.lean-ctx` — 上下文压缩 MCP
- `permissions.allow` — 权限白名单

```bash
# 如果没有现成的 settings.json，直接复制：
cp ultra-cost-effective/adapters/claude/settings.template.json .claude/settings.json
```

#### 第 3 步：在 CLAUDE.md 中导入规则

在项目根目录的 `CLAUDE.md` 中添加一行：

```markdown
@ultra-cost-effective/rules/main.md
```

---

## 自动生效机制

安装后以下功能自动激活，无需手动操作：

| 触发 | 自动行为 |
|------|---------|
| 任何 `npm test`、`cargo build` 等命令 | PreToolUse Hook 自动追加 `\| node tokenforge.cjs compress` |
| 任何工具调用后 | PostToolUse Hook 追踪 token 消耗 + 评估上下文健康 |
| 上下文超 60% 窗口 | PostToolUse 注入 `additionalContext` 提示 LLM 压缩 |
| `ctx_read` / `ctx_shell` 等 MCP 工具 | lean-ctx 自动缓存压缩，重读仅 ~13 tokens |
| 检测到第三方压缩器 | 自动跳过，避免双重压缩，记录冲突日志 |

---

## 日常使用

### 手动命令

| 关键词 | 效果 |
|--------|------|
| `token report` / `成本报告` | 查看 Token 消耗与节省明细 |
| `节能` / `省token` | 切换预设（quick → standard → extreme 循环） |
| `ultra-cost-effective status` | 查看各层运行状态、缓存命中率 |
| `ultra-cost-effective off` | 临时关闭节能（调试用） |
| `ultra-cost-effective on` | 恢复节能 |

---

## 三层预设详解

| 预设 | 启用层 | 节省 | 说明 |
|------|--------|------|------|
| `quick` | L1 | 50-70% | 仅输出压缩，最轻量。适合日常快速编码 |
| `standard` ⭐ | L1+L2+L3 | 70-85% | 输出压缩 + KV Cache + 上下文压缩。推荐 |
| `extreme` | 全七层 | 85-95% | 全开。大型项目、长会话、极致省钱 |

**切换方式：**
- 对话中说 `节能`（循环切换）
- 脚本直接调用：`node ultra-cost-effective/helpers/preset-switch.cjs standard`

---

## 压缩级别说明

| 级别 | 效果 | 适用 |
|------|------|------|
| light | 轻量压缩，保持可读性 | 调试、探索 |
| medium | 中度压缩，去除冗余 | 日常开发（默认） |
| aggressive | 激进压缩，只保留关键 | CI/CD、大量输出 |

**压缩仅发生在输出侧和上下文侧，不影响 LLM 推理质量。**

---

## Dynamic Workflows 集成

当你使用 Claude Code 的 `ultracode` 或 `/deep-research` 等工作流时：

### 自动行为

1. 检测到 `ultracode` / `/deep-research` / 自然语言触发
2. 生成预工作流压缩策略和乘法级节省估算
3. Guard 日志记录工作流拦截事件
4. session-memory 索引供所有子 agent 引用

### 5 种工作流预设

| 预设 | 适用 | 压缩比 | 特点 |
|------|------|--------|------|
| moderate | 研究分析 | 65% | 保留引用追溯 |
| aggressive | 大量 agent | 80% | 代码精确，丢弃引用 |
| codeAudit | 代码审计 | 75% | 代码精确，文档激进 |
| migration | 迁移 | 70% | 代码精确，保留文档引用 |
| refactor | 重构 | 60% | 高可靠性，保守压缩 |

### ROI 追踪

```bash
# 记录运行
node ultra-cost-effective/helpers/workflow-integrator.cjs track my-workflow 320000

# 查看报告
node ultra-cost-effective/helpers/workflow-integrator.cjs roi

# 按名称过滤
node ultra-cost-effective/helpers/workflow-integrator.cjs roi my-workflow
```

---

## 三色灯上下文监控

| 状态 | 含义 | 行为 |
|------|------|------|
| 🟢 green | 上下文健康 (<60% 窗口) | 正常处理 |
| 🟡 yellow | 中度占用 (60-80%) | 优先用索引引用，PostToolUse 注入提示 |
| 🔴 red | 高危 (>80% 窗口) | 立即压缩，PostToolUse 注入紧急提示 |

**检查命令：**
```bash
node ultra-cost-effective/helpers/context-interceptor.cjs check
```

---

## 模型路由

| 任务 | 模型 | 输入价 | KV Cache |
|------|------|--------|---------|
| 架构/设计/规划 | deepseek-v4-pro | ¥3.0/MTok | ¥0.025/MTok |
| 编码/测试/修复 | deepseek-v4-flash | ¥1.0/MTok | ¥0.02/MTok |

路由规则（配置层，在 presets/ 中定义）：
- 含「架构/设计/规划/分析」→ Pro
- 含「写代码/实现/修复/测试」→ Flash
- 上下文过长 → 自动降级 Flash

---

## 验证与调试

```bash
# 全部测试 (187项)
node ultra-cost-effective/bench/test-workflow.cjs
node ultra-cost-effective/bench/test-interceptor.cjs
node ultra-cost-effective/bench/test-guard.cjs
node ultra-cost-effective/bench/test-session-memory.cjs
node ultra-cost-effective/bench/test-hotswitch.cjs
node ultra-cost-effective/bench/test-hook-pipe.cjs

# 验证 Hook 命令分类
node ultra-cost-effective/helpers/tokenforge-hook.cjs --test

# 测试 tokenforge 压缩
echo "test output" | node ultra-cost-effective/helpers/tokenforge.cjs compress output --level medium

# 查看上下文健康
node ultra-cost-effective/helpers/context-interceptor.cjs health

# 查看 guard 审计
node ultra-cost-effective/helpers/ultra-cost-effective-guard.cjs audit

# 预设状态
node ultra-cost-effective/helpers/preset-switch.cjs status
```

---

## 卸载

```bash
# 1. 删除引擎目录
rm -rf ultra-cost-effective/

# 2. 移除 .claude/settings.json 中的 ultra-cost-effective 相关配置
#    (hooks, permissions, mcpServers, env)

# 3. 移除 CLAUDE.md 中的 @ultra-cost-effective/rules/main.md

# 4. 重启 Claude Code
```

---

## 常见问题

**Q: 压缩后原文还能找回来吗？**
能。session-memory 索引保留所有原文，通过 `retrieve <id>` 取回。原文存储在 `%TEMP%/ultra-cost-effective-headroom-store/`。

**Q: 影响其他技能吗？**
不影响。其他技能看到的工具输出已是压缩版本，如需原文同样通过 session-memory 索引取回。检测到第三方压缩器时自动跳过。

**Q: 两个项目能共用吗？**
核心引擎通过 `__dirname` 自定位，每个项目独立安装，互不干扰。

**Q: lean-ctx 装不上怎么办？**
框架不强制依赖 lean-ctx。跳过安装后 L1 中的 MCP 压缩层不生效，tokenforge PreToolUse Hook 仍在工作。

**Q: 支持其他模型吗？**
当前路由仅 DeepSeek。扩展需修改 `presets/` 中的路由规则和定价。

**Q: 没有 DeepSeek API 能用吗？**
tokenforge 输出压缩和 session-memory 不依赖特定模型。KV Cache 和模型路由需要 DeepSeek API。

---

## 系统要求

- Node.js ≥ 18
- lean-ctx（可选，`npm install -g lean-ctx-bin && lean-ctx init`）
- DeepSeek API 访问（L2/L3/L7 需要）
- Claude Code v2.1.154+（Dynamic Workflows 集成需要）或 Qoder

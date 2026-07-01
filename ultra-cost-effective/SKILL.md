---
name: ultra-cost-effective
description: 极致节能 — 不降低LLM输出质量的Token节省体系，综合节省60-90%。基于ccmvp七层节能架构+Headroom/lean-ctx/RTK国际方案。Claude Code & Qoder双平台通用。
version: 1.1.0
triggers: ultra-cost-effective, 节能, 省token, 节省, token report, 成本报告, 极致节能, token报告
role: infrastructure
scope: global
always-on: true
platforms: [claude-code, qoder]
dependencies:
  skills:
    - ultra-cost-effective-output    # L1: 输出压缩
    - ultra-cost-effective-cache     # L2+L3: KV Cache优化
    - ultra-cost-effective-router    # L7: DeepSeek双模型路由
    - ultra-cost-effective-monitor   # L0: 成本监控
  mcp:
    - lean-ctx        # L1: 上下文压缩（MCP工具）
---

# UltraCostEffective · 极致节能

> **省工** — AI编程Token节省体系。七层架构，不降低质量，综合节省 **60-90%** Token。

## 自动生效机制（Claude Code）

框架通过以下方式自动运行，无需手动触发：

| 机制 | 触发时机 | 效果 |
|------|---------|------|
| **PreToolUse Hook** | 每次 Bash 命令执行前 | 自动注入 `| node tokenforge.cjs compress` 管道 |
| **PostToolUse Hook** | 每次工具调用后 | 追踪 token 消耗 + 评估上下文健康度 |
| **lean-ctx MCP** | 文件读取/搜索/Shell | 自动缓存压缩，重读仅 ~13 tokens |
| **rules/main.md** | 会话始终 | LLM 行为指导：优先用 lean-ctx，引用 session-memory |

## 核心理念

```
    ┌── AOP Context Interceptor ──────────────────────┐
    │  三色灯监控 + Agent Spawn Guard + 规则注入       │
    │  确保每次 LLM 调用前上下文已被压缩              │
    └──────────────────────┬──────────────────────────┘
         │  Dynamic Workflows集成    │  ultracode 触发预压缩 + 乘法级节省 + ROI 回测
         │  L7  模型智能路由        │  DeepSeek Pro↔Flash 按需切换（配置层）
         │  L6  A2A通信压缩         │  session-memory 索引 + compressor-selector 热切换
         │  L5  阶段智能跳过        │  变更小跳过不必要阶段（配置层）
         │  L4  技能按需加载        │  非活跃技能 → ~25 token stub
         │────────────────────────┬──────────────────────────
         │  L3  长上下文预热        │  PRD/Spec 触发 KV Cache checkpoint（配置层）
         │  L2  共享前缀缓存        │  200-500 token 固定前缀，命中率 >90%
         │  L1  输出+上下文压缩     │  ★ tokenforge PreToolUse Hook + lean-ctx MCP
         └────────────────────────┴──────────────────────────
```

## 快速接入（目标项目）

### 1. 复制引擎
```bash
cp -r ultra-cost-effective/ /path/to/your-project/
```

### 2. 合并 settings.json
将 `adapters/claude/settings.template.json` 的内容合并到 `.claude/settings.json`

### 3. 在 CLAUDE.md 中导入规则
```markdown
@ultra-cost-effective/rules/main.md
```

### 4. 安装 lean-ctx（可选但推荐）
```bash
npm install -g lean-ctx-bin && lean-ctx init
```

### 5. 重启 Claude Code

## 快速命令

| 命令 | 说明 |
|------|------|
| `token report` / `成本报告` | 查看本次会话Token消耗与节省统计 |
| `节能` / `省token` | 开启/切换节能预设（quick/standard/extreme） |
| `ultra-cost-effective status` | 查看各层运行状态与缓存命中率 |

## 三层预设

| 预设 | 层级 | 预计节省 | 适用场景 |
|------|------|----------|----------|
| `quick` | L1 (tokenforge + lean-ctx) | ~50-70% | 日常编码，快速启动 |
| `standard` | L1+L2+L3 (含KV Cache) | ~70-85% | 标准项目开发，推荐 |
| `extreme` | 全7层 + Headroom可选 | ~85-95% | 大型项目/长会话，极致节省 |

## 验证

```bash
# 全部测试 (187项)
node ultra-cost-effective/bench/test-workflow.cjs
node ultra-cost-effective/bench/test-interceptor.cjs
node ultra-cost-effective/bench/test-guard.cjs
node ultra-cost-effective/bench/test-session-memory.cjs
node ultra-cost-effective/bench/test-hotswitch.cjs

# 前置校验
node ultra-cost-effective/helpers/prefix-validator.cjs --check-all
node ultra-cost-effective/helpers/tokenforge-hook.cjs --test

# 上下文健康
node ultra-cost-effective/helpers/context-interceptor.cjs health
```

## 技术溯源

- **ccmvp (1234567KF)**：七层节能架构、tokenforge、lean-ctx、skill-loader
- **Headroom (8.5k★)**：CCR可逆压缩、AST感知代码压缩、跨Agent记忆
- **LLMLingua (5k★)**：Microsoft Prompt压缩，BERT级token分类
- **lean-ctx (360★)**：MCP上下文工程，71工具，10种读取模式
- **RTK**：Rust单二进制CLI压缩，零依赖60-90%压缩

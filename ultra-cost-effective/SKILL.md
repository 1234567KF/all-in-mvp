---
name: ultra-cost-effective
description: 极致节能 — Qoder 专用 Token 节省体系。七层架构 + 项目级全链路监控（含A2A穿透），综合节省60-90%。
version: 2.0.0
triggers: ultra-cost-effective, 节能, 省token, 节省, token report, 成本报告, 极致节能, token报告
role: infrastructure
scope: project
always-on: true
platforms: [qoder]
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

## 自动生效机制（Qoder）

框架通过以下方式运行：

| 机制 | 触发时机 | 效果 |
|------|---------|------|
| **JSONL 扫描** | 会话过程 | `project-monitor.cjs` 读取 `.qoder/cache/` 下 transcript |
| **Hook 辅助** | 工具调用后 | `~/.qoder/hooks/*.cmd` 触发增量统计 |
| **rules/main.md** | 会话始终 | LLM 行为指导：优先用 lean-ctx，引用 session-memory |
| **项目配置** | `.qoder/settings.json` | 模型路由、环境变量、规则注入 |

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

### 1. 项目已预装
`.qoder/settings.json` 包含完整配置，`ultra-cost-effective/` 目录位于项目根。

### 2. 部署 Hook（可选，用于实时增量监控）
```powershell
Copy-Item ultra-cost-effective/adapters/qoder/hook-post-tool.cmd $env:USERPROFILE\.qoder\hooks\
```

### 3. 查看报告
```bash
node ultra-cost-effective/helpers/project-monitor.cjs
```

## 快速命令

| 命令 | 说明 |
|------|------|
| `node ultra-cost-effective/helpers/project-monitor.cjs` | 项目级全链路报告（含A2A+子Agent） |
| `node ultra-cost-effective/helpers/project-monitor.cjs --watch` | 实时监控模式 |
| `node ultra-cost-effective/helpers/project-monitor.cjs --json` | JSON 格式输出 |
| `node ultra-cost-effective/helpers/token-watcher.cjs` | 当前会话 Token 统计 |
| `node ultra-cost-effective/helpers/project-monitor.cjs --reset` | 重置统计 |

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

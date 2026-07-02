---
name: ultra-cost-effective
description: 极致节能 — Qoder 专用 Token 节省体系，综合节省60-90%。七层架构 + 项目级全链路监控（含A2A穿透）。
version: 2.0.0
triggers: ultra-cost-effective, 节能, 省token, 节省, token report, 成本报告
role: infrastructure
scope: project
always-on: true
platforms: [qoder]
parent: ../SKILL.md
---

# UltraCostEffective · 极致节能 (Qoder)

> Qoder 专属版本。七层节能架构 + 项目级全链路监控。

## 工作原理

### 监控方式
- **JSONL 扫描**：`project-monitor.cjs` 直接读取 Qoder 会话 transcript（`~/.qoder/cache/projects/`）
- **Hook 辅助**：`~/.qoder/hooks/` 下 `.cmd` 脚本触发增量扫描
- **零侵入**：不拦截 API，不修改 BASE_URL

### Hook 部署
将 `adapters/qoder/hook-post-tool.cmd` 复制到 `%USERPROFILE%\.qoder\hooks\` 目录下，Qoder 自动执行。

### 报告命令
| 命令 | 说明 |
|------|------|
| `node ultra-cost-effective/helpers/project-monitor.cjs` | 项目级全链路报告 |
| `node ultra-cost-effective/helpers/project-monitor.cjs --json` | JSON 格式 |
| `node ultra-cost-effective/helpers/project-monitor.cjs --watch` | 实时监控 |
| `node ultra-cost-effective/helpers/project-monitor.cjs --reset` | 重置统计 |
| `node ultra-cost-effective/helpers/token-watcher.cjs` | 会话级报告 |

### 项目配置
项目 `.qoder/settings.json` 已包含完整 ultra-cost-effective 配置（模型、规则、环境变量）。

## 七层架构

| 层 | 名称 | Qoder 实现方式 |
|----|------|---------------|
| L1 | 输出压缩 | tokenforge（Bash Hook 注入） |
| L2 | KV Cache | DeepSeek 原生，共享前缀 |
| L3 | 上下文预热 | PRD/Spec 文档触发 |
| L4 | 技能按需加载 | 非活跃技能 → stub |
| L5 | 阶段跳过 | 变更检测驱动 |
| L6 | A2A 压缩 | agent-spawn-guard 注入会话记忆 |
| L7 | 模型路由 | DeepSeek Pro↔Flash 按需切换 |

## 与主包关系

核心逻辑复用主包：
- `helpers/project-monitor.cjs` — 项目级监控入口
- `helpers/token-watcher.cjs` — JSONL 解析
- `helpers/perf/perf-tracker.cjs` — 成本追踪
- `helpers/agent-spawn-guard.cjs` — Agent spawn 拦截
- `helpers/session-memory.cjs` — 会话压缩记忆
- `rules/` — 所有规则文件

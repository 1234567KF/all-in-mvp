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
---
name: ultra-cost-effective
description: 极致节能 — 不降低LLM输出质量的Token节省体系，综合节省60-90%。Claude Code & Qoder双平台通用。
version: 1.1.0
triggers: ultra-cost-effective, 节能, 省token, 节省, token report, 成本报告
role: infrastructure
scope: global
always-on: true
platforms: [claude-code, qoder]
parent: ../SKILL.md
---

# UltraCostEffective · 极致节能 (Qoder 适配器)

> Qoder 平台专用适配器。与主 SKILL.md 保持 trigger 一致，通过 `adapters/qoder/` 下的适配器自动处理平台差异。

## Qoder 平台特殊配置

### 模型限制
- 仅暴露 `deepseek-v4-pro` 和 `deepseek-v4-flash`
- 通过 `settings.patch.json` 锁定模型列表
- 路由规则通过 `hook-adapter.cjs` 注入

### Hook 适配
- Qoder 的 Hook 触发机制与 Claude Code 不同
- 使用 `adapters/qoder/hook-adapter.cjs` 统一封装
- 自动检测平台（`ULTRA_COST_EFFECTIVE_PLATFORM=qoder` 或运行时特征）

### 与其他技能的路由
- UltraCostEffective 作为 `always-on` 基础设施技能，优先级高于项目技能
- 不影响其他 Qoder 技能的正常加载
- 默认仅 deepseek-v4-pro / deepseek-v4-flash 可选

## 安装

1. 将 `adapters/qoder/settings.patch.json` 合并到 Qoder `settings.json`
2. 将 `ultra-cost-effective/` 目录放置在项目或 Qoder 技能目录
3. 重启 Qoder

## 与主包关系

此为 Qoder 适配入口，核心逻辑复用主包的：
- `helpers/tokenforge.cjs` — 压缩引擎
- `helpers/tokenforge-hook.cjs` — 管道注入（通过 hook-adapter 调用）
- `helpers/skill-loader.cjs` — 技能加载
- `helpers/perf/perf-tracker.cjs` — 成本追踪
- `rules/` — 所有规则文件

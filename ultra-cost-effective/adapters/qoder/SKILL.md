---
name: ultra-cost-effective
description: 极致节能 — Qoder平台专用适配。不降低LLM输出质量的Token节省体系，综合节省60-90%。
version: 1.0.0
triggers: ultra-cost-effective, 节能, 省token, 节省, token report, 成本报告
role: infrastructure
scope: global
always-on: true
platform: qoder
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

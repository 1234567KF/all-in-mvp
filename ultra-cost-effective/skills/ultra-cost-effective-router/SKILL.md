---
name: ultra-cost-effective-router
description: DeepSeek双模型智能路由 — 根据任务复杂度自动切换 Pro↔Flash，含成本保护与熔断降级。
triggers: router, 路由, 模型切换, 模型, ultra-cost-effective-router
role: infrastructure
scope: global
always-on: true
platforms: [claude-code, qoder]
models: [deepseek-v4-pro, deepseek-v4-flash]
---

# UltraCostEffective Router · DeepSeek 双模型智能路由 (L7)

> 根据任务类型、上下文复杂度、成本预算，自动在 DeepSeek-v4-pro 和 v4-flash 之间切换，实现 **40-60% 成本节省**，同时保证复杂任务使用 Pro 模型不降低质量。

## 模型对照

| 模型 | 输入价格/MTok | 输出价格/MTok | KV Cache 命中价 | 适用场景 |
|------|-------------|-------------|----------------|----------|
| deepseek-v4-pro | ¥3.0 | ¥15.0 | ¥0.025 | 架构、设计、推理、复杂Agent |
| deepseek-v4-flash | ¥1.0 | ¥5.0 | ¥0.02 | 编码、测试、CR、文档、问答 |

## 路由决策逻辑

```
┌─────────────────────────────────────────────────┐
│              输入: 用户消息 + 当前上下文            │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. 语义分类                                      │
│     含「架构/设计/规划/方案/分析/评审」→ Pro        │
│     含「写代码/实现/修复/Bug/测试/调试」→ Flash     │
│     含「问答/解释/文档/注释」→ Flash               │
│                                                  │
│  2. 上下文感知                                    │
│     当前已加载技能数 > 8 → 降级 Flash              │
│     当前输入Token > 64K  → 降级 Flash              │
│                                                  │
│  3. 成本保护                                     │
│     单会话预算消耗 > 80% → 强制 Flash              │
│     当日成本 > 阈值（可配） → 强制 Flash           │
│                                                  │
│  4. 熔断降级                                     │
│     Pro API 返回 429/503  → 切换 Flash            │
│     连续3次 Pro 失败    → 锁 Flash 5分钟           │
│                                                  │
├─────────────────────────────────────────────────┤
│              输出: 目标模型名称                     │
└─────────────────────────────────────────────────┘
```

## 关键字匹配表

| 关键字 | 路由结果 | 优先级 |
|--------|----------|--------|
| 架构, 设计方案, 规划, 系统设计, 技术方案 | Pro | high |
| 分析, 评审, review, 评估, 调研 | Pro | medium |
| 重构, 优化方案, 迁移方案 | Pro | medium |
| 写代码, 实现, 修复, Bug, fix, 改 | Flash | high |
| 测试, test, 构建, build, lint | Flash | high |
| 文档, 注释, 解释, 什么是, 怎么用 | Flash | low |
| CR, code review, 审查 | Flash | medium |

## 成本保护策略

```javascript
// 会话预算追踪
sessionBudget = {
  limit: 50000,        // 单会话 token 预算上限（可配）
  used: 0,             // 已使用量
  proRatio: 0,         // Pro 模型使用占比
};

// 预算消耗 > 80% → 强制 Flash
if (sessionBudget.used / sessionBudget.limit > 0.8) {
  return 'deepseek-v4-flash';
}

// Pro 占比 > 50% 且预算 > 50% → 倾向 Flash
if (sessionBudget.proRatio > 0.5 && sessionBudget.used / sessionBudget.limit > 0.5) {
  if (taskComplexity === 'medium') return 'deepseek-v4-flash';
}
```

## 熔断降级

| 条件 | 动作 | 恢复条件 |
|------|------|----------|
| Pro 返回 429 (限流) | 切换 Flash，延迟 60s | 60s 后自动恢复 |
| Pro 返回 503 (不可用) | 切换 Flash，锁 5min | 5min 后重试 1 次 |
| 连续 3 次 Pro 失败 | 强制 Flash，锁 10min | 手动 `ultra-cost-effective router reset` |
| Flash 也失败 | 输出错误，不循环切换 | 人工介入 |

## Qoder 集成

- 模型列表通过 `adapters/qoder/settings.patch.json` 锁定
- 仅暴露 deepseek-v4-pro 和 deepseek-v4-flash
- 路由规则通过 `adapters/qoder/hook-adapter.cjs` 注入

## 手动控制

```bash
# 强制使用 Pro
export ULTRA_COST_EFFECTIVE_FORCE_MODEL=pro

# 强制使用 Flash
export ULTRA_COST_EFFECTIVE_FORCE_MODEL=flash

# 恢复自动路由
unset ULTRA_COST_EFFECTIVE_FORCE_MODEL
```

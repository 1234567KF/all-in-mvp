---
name: ultra-cost-effective-cache
description: KV Cache优化技能 — 共享前缀+长上下文预热+技能按需加载，利用DeepSeek 120x差价杠杆。
triggers: cache, 缓存, KV, 前缀, ultra-cost-effective-cache
role: infrastructure
scope: global
always-on: true
platforms: [claude-code, qoder]
models: [deepseek-v4-pro, deepseek-v4-flash]
rules:
  - rules/shared-prefix.md
  - rules/cache-optimization.md
helpers:
  - helpers/prefix-validator.cjs
  - helpers/cache-monitor.cjs
  - helpers/skill-loader.cjs
---

# UltraCostEffective Cache · KV Cache 优化 (L2+L3)

> 利用 DeepSeek API 的 Prompt Cache 机制，通过共享前缀、长上下文预热、技能按需加载三级策略，将输入成本从 ¥3.0/M 降至 ¥0.025/M（120x 差价杠杆）。

## 三级策略

### L1: 共享前缀缓存
- 所有 Agent 前 200-500 token 逐字相同
- 命中率目标: > 90%
- 价格: ¥3.0 → ¥0.025 / M tokens

### L2: 长上下文预热
- PRD/Spec/Design 文档主动预热
- 后续 Agent 80-90% 输入命中缓存
- 预热请求的回复控制为最短（~10 tokens）

### L3: 技能按需加载
- 非活跃技能 → ~25 token stub
- 活跃技能 → 完整加载
- 24 技能场景下压缩率 85-96%

## 验证工具

```bash
# 前缀一致性校验
node helpers/prefix-validator.cjs --check-all

# 缓存命中率监控
node helpers/cache-monitor.cjs --session

# 技能加载分析
node helpers/skill-loader.cjs --profile
```

## DeepSeek KV Cache 机制

| 条件 | 输入价格 | 说明 |
|------|----------|------|
| 缓存命中 | ¥0.025 / M tokens | 前N个token完全相同 |
| 缓存未命中 | ¥3.0 / M tokens | 全价 |
| TTL | 5 分钟 | 超时后缓存失效 |

## 实战示例

```
请求1: [共享前缀] [角色A] [任务A: 设计API]     → 写入缓存 (¥3.0)
请求2: [共享前缀] [角色B] [任务B: 实现API]     → 前缀命中 (¥0.025)，其余 ¥3.0
请求3: [共享前缀] [角色C] [任务C: 测试API]     → 前缀命中 (¥0.025)，其余 ¥3.0

每请求节省: 前缀部分 (400/1M × (3.0-0.025) = ~¥0.0012)
10 Agent 串行: 节省 ~¥0.01
```

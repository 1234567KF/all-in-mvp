---
name: ultra-cost-effective-monitor
description: Token成本监控 — 全链路追踪、分层节省归因、会话/任务/项目三级成本汇总。
triggers: monitor, 监控, token report, 成本报告, 统计
role: infrastructure
scope: global
always-on: true
platforms: [claude-code, qoder]
helpers:
  - helpers/perf/perf-tracker.cjs
  - helpers/perf/pricing.json
  - helpers/perf/optimization-registry.json
---

# UltraCostEffective Monitor · Token 成本监控 (L0)

> 全链路 Token 追踪与成本可视化。精确归因各压缩层的节省量，提供会话/任务/项目三级成本汇总。

## 追踪指标

| 指标 | 说明 | 来源 |
|------|------|------|
| Input/Output Tokens | 每次API调用的token消耗 | API Response |
| KV Cache Hit/Miss | 缓存命中分布 | deepseek cache_hit_tokens |
| tokenforge节省 | 输出压缩独立节省量 | tokenforge.cjs --dry-run |
| lean-ctx节省 | 上下文压缩独立节省量 | 文件重读diff |
| skill-loader节省 | 技能stub压缩节省量 | 技能元数据对比 |
| 模型路由节省 | Pro→Flash切换节省额 | 价格差异计算 |

## 成本报告

说出 `token report` 或 `成本报告` 获取：

```
═══ UltraCostEffective Token 报告 ═══
会话ID: sess_20260613_001
运行时间: 2h 15m

层级节省:
  L1 tokenforge:    -8,200 tokens (82%)
  L1 lean-ctx:      -3,500 tokens (35%)
  L2 KV Cache:      -12,000 tokens (120x savings)
  L4 skill-loader:  -4,800 tokens (91%)
  L7 router:        -¥4.50 (Flash代替Pro 3次)

总计:
  已用:    15,300 tokens
  已节省:  28,500 tokens (65%)
  成本:    ¥0.85
  预计节省: ¥8.20 (90%)
══════════════════════════
```

## 监控命令

```bash
# 会话级报告
node helpers/perf/perf-tracker.cjs --report

# 实时监控
node helpers/perf/perf-tracker.cjs --watch

# 导出CSV
node helpers/perf/perf-tracker.cjs --export session.csv
```

# KV Cache 优化策略 (UltraCostEffective L2+L3 · DeepSeek 专版)

> **always-on: true** | **scope: global** | **target: DeepSeek API**

## 三级缓存架构

```
┌──────────────────────────────────────────────────────────────────┐
│                      KV Cache 优化三层                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  L1: 共享前缀缓存 ──────────────────────────────────────────      │
│  │   前 200-500 token 在所有 Agent 间逐字相同                      │
│  │   命中率目标: > 90%                                            │
│  │   节省: 输入价格 ×120 差价杠杆 → ¥3.0 → ¥0.025 / M tokens      │
│  │                                                                │
│  ├── L2: 长上下文预热 ─────────────────────────────────────       │
│  │   在进入下一阶段前，预热 PRD / Spec / Design 文档                │
│  │   触发 KV Cache checkpoint，后续请求命中预热内容                  │
│  │   节省: 后续 Agent 80-90% 输入命中缓存                          │
│  │                                                                │
│  └── L3: 技能按需加载 ────────────────────────────────────         │
│      非活跃技能压缩为 ~25 token 元数据 stub                         │
│      活跃技能保持完整，按阶段切换                                   │
│      节省: 88-96% 技能系统提示 token                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## L1: 共享前缀优化

### 原理

DeepSeek API 的 Prompt Cache 按前缀匹配。如果 N 个 Agent 的前 200-500 tokens 完全相同，则第一个 Agent 写入缓存后，后续 N-1 个 Agent 的该部分只收 1/120 的价格。

### 实战策略

1. **统一系统提示头**：使用 `rules/shared-prefix.md` 定义的模板
2. **工具列表排序**：所有技能的工具列表按字母序排列，避免加载顺序差异
3. **环境变量统一**：`{PROJECT_ROOT}` 等变量使用固定宏，加载时替换为相同值

### 预期收益

```
假设: 10 个 Agent 串行执行，每个 Agent 系统提示 4000 tokens，
      其中前 400 tokens 是共享前缀。

无优化: 10 × 4000 × ¥3.0/M = ¥0.12  (全价，简单乘)
有L1:   Agent1:  4000 × ¥3.0/M   = ¥0.012    (首个写入)
       Agent2-10: 400  × ¥0.025/M = ¥0.00001 (9个命中)
                  + 3600 × ¥3.0/M   = ¥0.0097 
       单个: ¥0.0097, 9个: ¥0.0873
       总计: ¥0.012 + ¥0.0873 = ¥0.0993

节省: ¥0.12 - ¥0.0993 ≈ 17%
```

实际节省通常更高，因为系统提示往往有更大的共同部分。

## L2: 长上下文预热

### 原理

在进入编码阶段前，主动用完整 PRD/Spec 文档发起一次 API 调用（预热），使文档内容进入 DeepSeek KV Cache。
后续所有编码 Agent 引用该文档时，文档部分仅收缓存命中价。

### 预热时机

| 阶段 | 预热内容 | 触发条件 |
|------|----------|----------|
| 架构设计后 | Design.md / ARCHITECTURE.md | 进入实现阶段 |
| Spec 完成后 | spec.md / PRD.md | 进入编码阶段 |
| 代码审查前 | 目标文件的完整内容 | 进入审查阶段 |

### 预热调用模式

```
系统提示: [共享前缀] + "你正在预热缓存，请阅读并记忆以下文档。"
用户消息: <完整文档内容>
助手回复: "文档已加载，KV Cache 预热完成。"
```

> 注意：预热请求的 assistant 回复应尽量短（~10 tokens），减少无意义输出成本。

## L3: 技能按需加载

详见 `helpers/skill-loader.cjs` 和 `skills/ultra-cost-effective-cache/SKILL.md`。

核心思路：
- `always-on` 技能 → 始终完整加载
- 当前阶段活跃技能 → 完整加载
- 非活跃技能 → 仅加载元数据 stub（name + triggers + 描述）≈ 25 tokens
- 技能触发时 → 动态展开完整内容

## 监控指标

使用 `helpers/cache-monitor.cjs` 追踪：

```bash
node helpers/cache-monitor.cjs --session
# 输出:
# Cache Hit Rate: 78% (3,200 / 4,100 tokens)
# L1 Prefix Hits:  12 / 15 requests (80%)
# L2 Warmup Hits:  5 / 8 requests (62%)
# L3 Skill Stubs:  18 / 24 skills compressed (75%)
# Estimated Savings: ¥12.50 this session
```

## 验证

- [ ] `shared-prefix.md` 在所有技能中保持一致（`prefix-validator.cjs --check-all`）
- [ ] DeepSeek API 响应中包含 `cache_hit_tokens` / `cache_read_input_tokens` 字段
- [ ] 连续 3 次请求前缀命中率 > 70%
- [ ] 技能 stub 压缩率 > 85%

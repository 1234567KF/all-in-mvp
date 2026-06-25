# DeepSeek KV Cache 缓存优化

> **价格杠杆**：Pro 模型缓存命中 ¥0.025/M tokens vs 未命中 ¥3/M（120x 差价）。
> Flash 模型缓存命中 ¥0.02/M vs 未命中 ¥1/M（50x 差价）。
> **缓存在 DeepSeek API 上默认开启**，但命中率取决于 prompt 前缀一致性。

---

## 缓存原理

### 缓存命中条件

服务器端 KV Cache 通过**公共前缀检测**实现。后续请求的 messages 前缀必须与已缓存的请求逐字相同（包括空格、换行、标点）才能命中。

### 三种落盘时机

| 机制 | 说明 | 首次请求影响 |
|------|------|-------------|
| **请求结束落盘** | 请求完成时，整个 session 的 KV Cache 落盘 | 首请求完整收费，后续命中 |
| **固定 token 间隔落盘** | 每 N 个 token 设置 checkpoin | 长文档可在中途 checkpoint 落盘 |
| **前缀检测** | 新请求的 messages 与缓存前缀匹配 → 从 checkpoint 恢复 | — |

### TTL

缓存 TTL 为 **5 分钟**。两次请求间隔超过 5min 则缓存失效。

---

## 优化策略

### 1. 全局 System Prompt 统一

所有技能/agent 的 system prompt 前 200-500 token 必须逐字相同：

```
### SHARED PREFIX START
[统一的项目上下文、工具约束、通信协议、输出格式 — 所有 agent 共享]
### SHARED PREFIX END

[差异化内容 — 角色、阶段、任务描述]
```

**规则**：
- 共享部分 MUST 放在最前面（前 200-500 token）
- MUST 逐字相同（空格、换行、标点、中英文符号全角/半角）
- 差异化内容 MUST 放在 `### SHARED PREFIX END` 之后
- 所有技能/agent 的共享前缀 MUST 从同一模板复制（禁止手动输入）

### 2. 长上下文预热策略

当首次请求涉及长文档（如 PRD.md、Spec 文件）时：

```
Step 1: 预热请求（带长文档的 system prompt，无实际任务）
  → systemPrompt 包含统一前缀 + 长文档
  → 请求发出，cache 在请求结束时落盘
Step 2: 真实请求（system prompt 前缀与预热请求完全一致）
  → 共享前缀部分命中缓存
  → 仅差异化部分按全价计费
```

**预热约束**：
- 预热请求的 messages 结构 MUST 与真实请求的前缀完全一致（role 顺序、内容排列）
- 预热请求的内容可以部分取巧（无需完整推理），但前缀 MUST 匹配
- 预热在 spawn 第一个 agent 前执行

### 3. 多轮对话缓存保持

多轮对话场景下：

```
# 第一轮所有 agent 共享前缀 → 缓存命中
# 第二轮 messages 追加了历史对话 → 前缀变了 → 缓存失效
```

**保持策略**：
- 每轮都 append 到 messages（不清除历史），保持前缀连续性
- 避免 messages 结构变化：固定 system/user/assistant 轮换顺序
- 若必须清历史 → 重新预热

### 4. 缓存命中率监控

从 API 响应中读取缓存指标：

```python
usage.prompt_cache_hit_tokens    # 命中缓存的 prompt token 数
usage.prompt_cache_miss_tokens   # 未命中的 prompt token 数
```

**缓存命中率公式**：

```
cache_hit_rate = hit_tokens / (hit_tokens + miss_tokens)
```

| 命中率 | 判定 | 动作 |
|--------|------|------|
| > 70% | 优秀 | 维持现状 |
| 30-70% | 一般 | 检查前缀一致性（空格/换行/顺序） |
| < 30% | 差 | 触发优化提示，检查预热策略和前缀一致性 |

---

## 收益估算

以 `/夯` 三队 6 agent 并发为例：

| 场景 | 无缓存优化 | 有缓存优化 | 节省 |
|------|-----------|-----------|------|
| 总输入 tokens | 6 × 8K = 48K | 1 × 8K + 5 × 0.5K(前缀命中) + 5 × 2K(suffix 全价) = 20.5K | 57% |
| 成本 (Pro) | 48K × ¥3/M = ¥0.144 | 8K × ¥3 + 12.5K × ¥0.025 = ¥0.0243 | **83%** |
| 成本 (Flash) | 48K × ¥1/M = ¥0.048 | 8K × ¥1 + 12.5K × ¥0.02 = ¥0.00825 | **83%** |

---

## 检查清单

- [ ] 所有 agent 共享前缀从前 200-500 token 开始，逐字相同
- [ ] 共享前缀与差异化内容之间有明确的边界标记
- [ ] 预热请求在 spawn 第一个 agent 前执行
- [ ] 预热请求的 messages 结构与真实请求匹配
- [ ] 多轮对话保持 messages 连续性（不中途清历史）
- [ ] 从 API 响应读取 `usage.prompt_cache_hit_tokens` 监控命中率
- [ ] 命中率 < 30% 时自动触发优化告警

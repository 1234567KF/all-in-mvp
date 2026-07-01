# UltraCostEffective Token 监控 — 技术规格说明书

> 版本 1.0 | 2026-06-29 | 供第三方审计

---

## 1. 架构概览

```
Claude Code 进程
  │
  ├── 通过 DeepSeek Anthropic API 调用 LLM
  │     URL: https://api.deepseek.com/anthropic
  │     认证: Bearer sk-xxx (settings.local.json)
  │
  └── 自动写入会话 transcript 到磁盘
        ↓
        ~/.claude/projects/<project-hash>/<session-uuid>.jsonl
        ↓
        token-watcher.cjs 读取并解析
        ↓
        .ultra-cost-effective-tracker.json
        ↓
        token report 命令展示
```

**关键设计原则**：零侵入。不修改 API 调用路径、不拦截网络流量、不改变 Claude Code 行为。完全依赖 Claude Code 自身已写入磁盘的会话记录。

---

## 2. 数据源

### 2.1 JSONL 文件位置

```
~/.claude/projects/<project-dirname>/<session-uuid>.jsonl
```

**定位逻辑**（token-watcher.cjs `findActiveSession()` 函数，第 58-82 行）：

```javascript
function findActiveSession() {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  // 遍历所有子目录，找最近修改的 .jsonl 文件
  // 按 mtimeMs 排序，取最新
}
```

也可手动指定：`--session <path>`

### 2.2 JSONL 文件格式

每行一个 JSON 对象，代表一次 Claude Code 内部事件。关键字段：

```json
{
  "parentUuid": "xxx",
  "isSidechain": false,
  "message": {
    "model": "deepseek-v4-pro",
    "usage": {
      "input_tokens": 415,
      "output_tokens": 242,
      "cache_read_input_tokens": 477952,
      "cache_creation_input_tokens": 0,
      "service_tier": "standard"
    }
  },
  "type": "user",
  "uuid": "yyy",
  "timestamp": "2026-06-29T08:00:00.000Z",
  "sessionId": "7e6e10d3-..."
}
```

**提取规则**（token-watcher.cjs `parseJsonl()` 函数，第 86-112 行）：

1. 只读文件新增部分（`stat.size - lastPosition` 增量读取）
2. 每行 `JSON.parse`
3. 筛选条件：`entry.message?.usage` 存在即记录
4. 不关心 `type` 字段——无论 user/assistant/tool_result，只要有 `usage` 都计入

### 2.3 增量读取保证

```javascript
const buf = Buffer.alloc(stat.size - lastPosition);
fs.readSync(fd, buf, 0, buf.length, lastPosition);
```

- 每次只读上次位置之后的新增字节
- 跨行边界由 `split('\n')` 处理（可能截断最后一行，下次补全）
- `lastPosition` 持久化在内存中（watch 模式下）

---

## 3. 数据流转

### 3.1 提取规则映射

| JSONL 字段 | Tracker 字段 | 说明 |
|-----------|-------------|------|
| `message.usage.input_tokens` | `totalInputTokens` | 本次 LLM 调用的 prompt tokens |
| `message.usage.output_tokens` | `totalOutputTokens` | 本次 LLM 调用的 completion tokens |
| `message.usage.cache_read_input_tokens` | `totalCacheHitTokens` | KV Cache 命中的 tokens |
| `input_tokens - cache_read_input_tokens` | `totalCacheMissTokens` | 未命中缓存的 tokens |
| `message.model` | `modelStats[model]` | 按模型分桶统计 |

### 3.2 累计逻辑（writeTracker 函数，第 115-152 行）

```javascript
for (const entry of entries) {
  session.totalCalls++;
  session.totalInputTokens += entry.usage.input_tokens;
  session.totalOutputTokens += entry.usage.output_tokens;
  session.totalCacheHitTokens += entry.usage.cache_read_input_tokens;
  session.totalCacheMissTokens += 
    entry.usage.input_tokens - entry.usage.cache_read_input_tokens;
}
```

**注意**：如果同一行 JSONL 的 `input_tokens` 已包含 `cache_read_input_tokens`（即 `input_tokens` 是总输入 tokens，其中部分命中缓存），则 `cacheMissTokens = inputTokens - cacheHitTokens`。这是 Anthropic API 的语义——`input_tokens` 是请求的总 token 数，`cache_read_input_tokens` 是其中从缓存读取的部分。

### 3.3 存储位置

```
<项目根目录>/.ultra-cost-effective-tracker.json
```

项目根目录由 `resolveProjectRoot()` 确定（perf-tracker.cjs 第 26-43 行）：

```javascript
// 从脚本所在目录 (helpers/perf/) 向上查找包含 ultra-cost-effective/ 的目录
let dir = __dirname;  // .../ultra-cost-effective/helpers/perf/
for (let i = 0; i < 5; i++) {
  dir = path.dirname(dir);
  if (fs.existsSync(path.join(dir, 'ultra-cost-effective'))) return dir;
}
```

对于本项目：`d:\枪斧AI\全自动CRM-CC`

---

## 4. 成本计算公式

### 4.1 DeepSeek 定价（2026-06 基准）

| 项目 | Pro 模型 | Flash 模型 |
|------|---------|-----------|
| 输入（未命中缓存） | ¥3.00 / M tokens | ¥1.00 / M tokens |
| 输出 | ¥9.00 / M tokens | ¥3.00 / M tokens |
| 输入（缓存命中） | ¥0.025 / M tokens | ¥0.02 / M tokens |

数据源：`helpers/perf/pricing.json`

### 4.2 单次调用成本

```
cacheHitCost  = cacheHitTokens  / 1_000_000 × 0.025  (缓存命中)
cacheMissCost = cacheMissTokens / 1_000_000 × 3.00   (缓存未命中)
outputCost    = outputTokens    / 1_000_000 × 9.00   (输出)
totalCost     = cacheHitCost + cacheMissCost + outputCost
```

### 4.3 KV Cache 命中率

```
hitRate = cacheHitTokens / (cacheHitTokens + cacheMissTokens)
```

### 4.4 节省估算

```
withoutCacheCost = totalInputTokens / 1_000_000 × 3.00 + outputCost
savings = withoutCacheCost - actualCost
savingsRate = savings / withoutCacheCost × 100%
```

---

## 5. 命令参考

### 5.1 单次扫描

```bash
# 扫描当前活跃会话，输出完整报告
node ultra-cost-effective/helpers/token-watcher.cjs

# 指定 JSONL 文件
node ultra-cost-effective/helpers/token-watcher.cjs --session ~/.claude/projects/xxx/session.jsonl
```

### 5.2 持续监视

```bash
# 每 30 秒扫描增量，终端实时显示
node ultra-cost-effective/helpers/token-watcher.cjs --watch
```

### 5.3 Hook 估算模式（无需 JSONL）

```bash
# 基于 PostToolUse hook 的字符估算
node ultra-cost-effective/helpers/perf/perf-tracker.cjs --report
```

### 5.4 验证数据文件

```bash
# 直接查看 JSONL 最后一条记录的 usage
tail -1 ~/.claude/projects/<project>/<session>.jsonl | jq '.message.usage'
```

---

## 6. 数据校验方法

### 6.1 手动抽查

```bash
# 1. 查看 JSONL 总行数
wc -l ~/.claude/projects/<project>/<session>.jsonl

# 2. 统计有 usage 的行数
grep -c '"usage"' ~/.claude/projects/<project>/<session>.jsonl

# 3. 累加所有 usage.input_tokens（用 jq）
cat session.jsonl | jq -s 'map(.message.usage.input_tokens // 0) | add'

# 4. 对比 tracker 报告中的 totalInputTokens
node token-watcher.cjs | grep "输入 Token"
```

### 6.2 DeepSeek 控制台对比

DeepSeek 平台 (platform.deepseek.com) 提供用量统计。将 tracker 报告的 `totalInputTokens + totalOutputTokens` 与平台控制台的 "Tokens Used" 对比。差值应 < 5%（因 JSONL 可能不包含某些系统级调用）。

### 6.3 成本对比

```python
# 用 tracker 数据计算成本
input_tokens = 1658900
output_tokens = 898600
cache_hit = 396628100
cache_miss = 994300

cache_hit_cost = cache_hit / 1_000_000 * 0.025   # ¥9.92
cache_miss_cost = cache_miss / 1_000_000 * 3.00   # ¥2.98
output_cost = output_tokens / 1_000_000 * 9.00    # ¥8.09
total = cache_hit_cost + cache_miss_cost + output_cost  # ¥20.99

# 对比 DeepSeek 账单
```

---

## 7. 边界与限制

| 场景 | 处理方式 |
|------|---------|
| JSONL 文件不存在 | 提示手动指定 `--session` |
| JSONL 中某行无 `usage` 字段 | 跳过（非 LLM 调用事件） |
| JSONL 行 JSON 解析失败 | 跳过（静默） |
| tracker 文件写入失败 | 静默（不影响 Claude Code） |
| `cache_read_input_tokens` > `input_tokens` | `cacheMissTokens = 0`（不会为负） |
| 跨 Claude Code 重启 | 需重新运行 watcher 扫描 |
| 多个项目同时使用 | 每个项目的 tracker 文件独立 |

---

## 8. 文件清单

```
ultra-cost-effective/helpers/
├── token-watcher.cjs          ★ 核心：JSONL 解析 + tracker 写入 + 报告
├── perf-tracker.cjs           Hook 估算模式（备用）+ --real 兼容
├── api-proxy.cjs              废弃方案：HTTP 代理拦截（不可用，保留参考）
└── perf/
    └── pricing.json           DeepSeek 定价基准

项目根目录:
└── .ultra-cost-effective-tracker.json   ← 追踪数据存储

Claude Code 数据源:
└── ~/.claude/projects/<project>/<session>.jsonl
```

---

## 9. 审计检查清单

- [ ] JSONL 路径确认：`ls ~/.claude/projects/` 验证存在
- [ ] 数据格式确认：`tail -1 session.jsonl | jq '.message.usage'` 验证结构
- [ ] 累加验证：用独立脚本（jq/python）累加确认总 token 数
- [ ] 缓存语义确认：确认 `input_tokens` 是"总请求 tokens"而非"未命中部分"
- [ ] 定价确认：`helpers/perf/pricing.json` 与 DeepSeek 官网一致
- [ ] 跟踪文件确认：`.ultra-cost-effective-tracker.json` 内容可读
- [ ] 跨平台确认：macOS/Linux 路径分隔符正确

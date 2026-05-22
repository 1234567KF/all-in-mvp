# M03: stats-api — 统计分析 API

## 模块职责

- **做什么**: 实现 F-007（Token 消耗统计）、F-008（成本估算）、F-009（优化节省汇总）的 Service 层聚合逻辑，提供统计数据查询 API
- **不做什么**: 不处理数据采集写入（归 M02），不包含看板数据整合（归 M04）

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M01 | 必须 | db-core 提供数据库查询能力 |

## 领域标注

- **领域**: 业务核心
- **类型**: 后端 (Service)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `backend/src/services/stats-aggregator.ts` | 统计数据聚合逻辑 |
| `backend/src/services/cost-calculator.ts` | 成本估算引擎 |
| `backend/src/api/stats/index.ts` | 路由注册（stats/cost/savings/model-distribution 等统计端点） |
| `backend/src/api/stats/handlers.ts` | 请求处理器（getTurnStats, getTurnCost, getTurnSavings, getModelDistribution） |

## 接口清单（纯读取，与 M02 共享 /api/turns/ 路由前缀）

### GET /api/turns/stats — Token 统计 (F-007)

**响应数据**:
| 字段 | 类型 | 计算逻辑 |
|------|------|---------|
| total_calls | integer | COUNT(turns) + COUNT(a2a) |
| total_input_tokens | integer | SUM(input_uncached + input_cached) |
| total_input_uncached | integer | SUM(input_uncached) |
| total_input_cached | integer | SUM(input_cached) |
| cache_hit_rate | float | cached / total_input × 100% |
| total_output_tokens | integer | SUM(output_tokens) |
| model_switch_count | integer | COUNT(opt.model_switched = true) |
| model_count | integer | COUNT(DISTINCT model_used) |

### GET /api/turns/cost — 成本估算

**响应数据**:
| 字段 | 类型 | 计算逻辑 |
|------|------|---------|
| items[] | array | 按模型分组计算 |
| .input_cost | float | (uncached/1M × input_price) + (cached/1M × cache_price) |
| .output_cost | float | output/1M × output_price |
| .total_cost | float | input_cost + output_cost |
| .has_pricing | boolean | 是否有定价数据 |
| total_cost | float | SUM(所有模型总成本) |

### GET /api/turns/savings — 优化节省

**响应数据**: 各机制节省明细 + 总节省 + model_switch 单独展示

### GET /api/turns/model-distribution — 模型分布

**响应数据**: 按模型分组的调用次数和占比百分比

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-014 | IF 总输入 Token = 0 THEN 缓存率 = 0.0% | 避免除零错误 |
| BR-015 | IF 字段缺失 THEN 按 0 处理 | 不影响整体统计 |
| BR-016 | IF 模型无定价 THEN 成本 = 0 并标记"无定价" | 不影响其他模型 |
| BR-017 | IF currency 未定义 THEN 默认 '¥' | 使用人民币符号 |
| BR-018 | IF cache_read_per_mtok 未定义 THEN 使用 input_per_mtok | 避免缓存成本为 0 |
| BR-008 | IF model_switched=true THEN 不计入节省汇总 | 单独展示 |
| BR-019 | IF exclude_from_savings=true THEN 不计入节省 | 单独展示 |

## 验收标准

### Happy Path
- AC-007: Token 统计准确（SUM 计算正确，缓存率正确，各模型独立计算）
- AC-008: 成本估算准确（输入成本、输出成本、总成本计算正确）
- AC-009: 优化节省汇总正确（各机制节省独立计算，model_switch 不计入总节省）

### Exception Path
- 总输入为 0 时缓存率正确显示 0.0% 而非报错
- 无定价模型的成本显示为 0 并标记"无定价"
- 缺少 currency 字段时正确默认使用 '¥'

---

**【锁定版】** 已通过 Grill 审查

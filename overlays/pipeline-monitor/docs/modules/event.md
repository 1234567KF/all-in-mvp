# Module: event — 事件记录与查询模块
<!-- @version: 1.0.draft -->
<!-- @status: DRAFT -->

## 1. 模块职责边界

### 做什么
- 写入单条事件（关联当前活跃 Pipeline）
- 批量写入事件（事务保证原子性）
- 多维度查询事件（pipeline_id + stage + agent + event_type + 时间范围 + 关键词搜索）
- 统计聚合（概览、Stage 耗时、Agent 活跃度）
- 事件数量上限校验（单 Pipeline 最大 10000 条）
- seq 自增管理（全局序号，保证时间线排序）

### 不做什么
- 不做事件修改/删除（日志不可变）
- 不做 WebSocket 实时推送
- 不做日志导出

## 2. 依赖的其他模块

| 依赖模块 | 依赖原因 |
|---------|---------|
| pipeline | 事件写入需关联 pipeline_id；查询当前活跃 Pipeline 用于自动绑定 |

## 3. 所属领域

**业务核心** — 流水线的核心数据采集与查询能力

## 4. 接口清单

| 方法 | 路径 | 功能 | 请求参数 | 响应 |
|------|------|------|---------|------|
| POST | /api/events | 写入单条事件 | EventCreate body | 201 + Event |
| POST | /api/events/batch | 批量写入 | EventBatchCreate body | 201 + {count, events} |
| GET | /api/events | 查询事件列表 | query: pipeline_id, stage, agent_name, event_type, from, to, search, page, pageSize, sort | 200 + EventList |

### 统计接口

| 方法 | 路径 | 功能 | 请求参数 | 响应 |
|------|------|------|---------|------|
| GET | /api/stats/overview | 概览统计 | query: pipeline_id | 200 + StatsOverview |
| GET | /api/stats/stage-duration | Stage 耗时 | query: pipeline_id | 200 + StageDuration[] |
| GET | /api/stats/agent-activity | Agent 活跃度 | query: pipeline_id | 200 + AgentActivity[] |

### 错误场景
- POST /api/events 无活跃 Pipeline → 400 "No active pipeline"
- 事件数量超过 10000 上限 → 400 "Event limit exceeded"
- 批量写入中任一条数据无效 → 400，事务回滚
- event_type 不在合法枚举中 → 400 "Invalid event_type"

## 5. 数据库表

仅操作 `events` 表：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | UUID |
| pipeline_id | TEXT | FK → pipelines.id | 所属 Pipeline |
| event_type | TEXT | NOT NULL | 12 种枚举 |
| agent_name | TEXT | DEFAULT '' | Agent 名称 |
| stage | TEXT | DEFAULT '' | Stage1/2/3/4/5 |
| message | TEXT | DEFAULT '' | 事件描述 |
| metadata | TEXT | DEFAULT '{}' | JSON 扩展 |
| timestamp | TEXT | NOT NULL | ISO8601 |
| seq | INTEGER | NOT NULL | 全局自增序号 |

## 6. 验收标准

### Happy Path
| 场景 | Given | When | Then |
|------|-------|------|------|
| 写入事件 | Pipeline RUNNING | POST /api/events {event_type, message} | 返回 201，seq 自动递增 |
| 批量写入 | Pipeline RUNNING | POST /api/events/batch {events: [...]} | 返回 201，count=事件数 |
| 按 Stage 过滤 | 已有 Stage2 和 Stage3 事件 | GET /api/events?pipeline_id=X&stage=Stage2 | 仅返回 Stage2 事件 |
| 组合过滤 | 已有多个 ERROR 在 Stage3 | GET /api/events?stage=Stage3&event_type=ERROR | 仅返回 Stage3 ERROR |
| 关键词搜索 | 事件 message 含 "TDD" | GET /api/events?search=TDD | 返回匹配事件 |
| 统计概览 | 已有 50 条事件 | GET /api/stats/overview?pipeline_id=X | 返回分布统计 |
| Stage 耗时 | 已有 STAGE_START + STAGE_END | GET /api/stats/stage-duration?pipeline_id=X | 返回每个 Stage 的实际耗时 |

### Exception Path
| 场景 | Given | When | Then |
|------|-------|------|------|
| 无活跃 Pipeline 写事件 | 无 RUNNING Pipeline | POST /api/events | 返回 400 "No active pipeline" |
| 事件超限 | 已有 10000 条事件 | POST /api/events | 返回 400 "Event limit exceeded" |
| 批量写入部分无效 | events 数组中一条缺 event_type | POST /api/events/batch | 返回 400，无任何事件写入（事务回滚） |
| 非法 event_type | Pipeline RUNNING | POST /api/events {event_type:"INVALID"} | 返回 400 |

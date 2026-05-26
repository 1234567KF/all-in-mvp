# Module: pipeline — 流水线管理模块
<!-- @version: 1.0.draft -->
<!-- @status: DRAFT -->

## 1. 模块职责边界

### 做什么
- 创建 Pipeline 记录（触发流水线时）
- 更新 Pipeline 状态（RUNNING → DONE/FAILED/CANCELLED）
- 查询当前活跃 Pipeline（最新一条）

### 不做什么
- 不处理事件记录（由 event 模块负责）
- 不做 Pipeline 历史对比（v2.0）
- 不做 Pipeline 归档/清理

## 2. 依赖的其他模块

| 依赖模块 | 依赖原因 |
|---------|---------|
| 无 | 基础模块，无上游依赖 |

## 3. 所属领域

**工具与配置** — 提供 Pipeline 生命周期的基础设施能力

## 4. 接口清单

| 方法 | 路径 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | /api/pipelines | 创建 Pipeline | PipelineCreate | 201 + Pipeline |
| PATCH | /api/pipelines/:id | 更新状态 | PipelineUpdate | 200 + Pipeline |
| GET | /api/pipelines/current | 获取当前 Pipeline | — | 200 + Pipeline |

### 错误场景
- POST 缺少 name → 400
- PATCH 的 Pipeline 不存在 → 404
- PATCH 的 status 非法值 → 400
- GET /current 无 Pipeline → 404

## 5. 数据库表

仅操作 `pipelines` 表：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | UUID |
| name | TEXT | NOT NULL | 流水线名称 |
| status | TEXT | NOT NULL, DEFAULT 'RUNNING' | RUNNING/DONE/FAILED/CANCELLED |
| mode | TEXT | NOT NULL, DEFAULT 'full' | full/incremental/simple |
| task_desc | TEXT | DEFAULT '' | 任务描述 |
| created_at | TEXT | NOT NULL | datetime('now') |
| updated_at | TEXT | NOT NULL | datetime('now') |

## 6. 验收标准

### Happy Path
| 场景 | Given | When | Then |
|------|-------|------|------|
| 创建 Pipeline | — | POST /api/pipelines {name, mode, task_desc} | 返回 201，status=RUNNING |
| 更新状态为 DONE | Pipeline 存在且 RUNNING | PATCH /api/pipelines/:id {status: "DONE"} | 返回 200，status=DONE，updated_at 更新 |
| 获取当前 Pipeline | 存在 ≥1 条 Pipeline | GET /api/pipelines/current | 返回最新一条（按 created_at DESC） |

### Exception Path
| 场景 | Given | When | Then |
|------|-------|------|------|
| 创建缺少必填字段 | — | POST /api/pipelines {} (无 name) | 返回 400 |
| 更新不存在的 Pipeline | pipeline_id 不存在 | PATCH /api/pipelines/nonexistent | 返回 404 |
| 无 Pipeline 时查 current | DB 中无 Pipeline 记录 | GET /api/pipelines/current | 返回 404 |

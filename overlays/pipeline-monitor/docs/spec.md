<!-- spec.md 标准头 -->
# Spec: Pipeline Monitor MVP
- 版本: v1.0.draft
- 基于 PRD: PRD.md (v1.0.draft)
- 生成时间: 2026-05-26
- 负责 Agent: 架构专家-①
- 变更历史:
  - v1.0.draft: 初版产出

<!-- 依赖: PRD.md -->

---

## 一、技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 后端框架 | Hono | ^4.x | 轻量 TypeScript 后端 |
| ORM | Drizzle ORM | ^0.38.x | 类型安全的 SQL 工具包 |
| 数据库 | SQLite (better-sqlite3) | — | 零配置，WAL 模式 |
| 前端框架 | Vue 3 | ^3.5.x | Composition API |
| 构建工具 | Vite | ^6.x | 快速 HMR |
| 包管理 | pnpm | — | 高效磁盘利用 |
| 测试 | Vitest | ^3.x | 与 Vite 共享配置 |
| UUID | nanoid / crypto.randomUUID() | — | 轻量 ID 生成 |

## 二、项目结构

```
pipeline-monitor/
├── docs/
│   ├── PRD.md
│   ├── spec.md              ← 本文件
│   ├── schema.sql
│   └── api-contract.yaml
├── src/
│   ├── server.ts            # Hono 入口
│   ├── db/
│   │   ├── index.ts         # Drizzle 连接初始化
│   │   └── schema.ts        # Drizzle Schema 定义
│   ├── modules/
│   │   ├── pipeline/
│   │   │   ├── routes.ts    # Pipeline CRUD 路由
│   │   │   ├── service.ts   # Pipeline 业务逻辑
│   │   │   └── types.ts     # Pipeline DTO 类型
│   │   └── event/
│   │       ├── routes.ts    # Event 写入/查询路由
│   │       ├── service.ts   # Event 业务逻辑 + 统计
│   │       └── types.ts     # Event DTO 类型
│   └── lib/
│       ├── logger.ts        # 日志 SDK（Agent 调用入口）
│       └── utils.ts         # UUID 生成等工具
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── api/
│   │   │   └── client.ts    # API 调用封装
│   │   ├── components/
│   │   │   ├── DashboardOverview.vue
│   │   │   ├── TimelineView.vue
│   │   │   ├── FilterPanel.vue
│   │   │   ├── EventDetailModal.vue
│   │   │   └── StatsCharts.vue
│   │   └── composables/
│   │       └── usePipeline.ts  # Pipeline 状态管理
│   └── package.json
├── mocks/
│   └── server.ts            # Mock API 服务
├── integration-tests/
│   ├── modules/
│   └── scenarios/
├── .mvp-pipeline/
│   └── pipeline-execution-log.md
└── package.json
```

## 三、模块划分

### 模块 1: pipeline（流水线管理）
- **职责**: Pipeline 生命周期管理（创建、状态更新、查询）
- **路由前缀**: `/api/pipelines`
- **依赖**: 无（基础模块）
- **领域**: 工具与配置

### 模块 2: event（事件记录与查询）
- **职责**: 事件写入、批量写入、多维度查询、统计聚合
- **路由前缀**: `/api/events`, `/api/stats`
- **依赖**: pipeline（需关联 pipeline_id）
- **领域**: 业务核心

## 四、数据库设计

参见 [schema.sql](./schema.sql) —— 2 张表：

- `pipelines` — 流水线实例
- `events` — 事件日志

## 五、接口契约

参见 [api-contract.yaml](./api-contract.yaml) —— 9 个端点：

| 方法 | 路径 | 模块 |
|------|------|------|
| POST | /api/pipelines | pipeline |
| PATCH | /api/pipelines/:id | pipeline |
| GET | /api/pipelines/current | pipeline |
| POST | /api/events | event |
| POST | /api/events/batch | event |
| GET | /api/events | event |
| GET | /api/stats/overview | event (统计) |
| GET | /api/stats/stage-duration | event (统计) |
| GET | /api/stats/agent-activity | event (统计) |

## 六、非功能需求（全部推迟到 v1.1+）

| 需求 | 状态 |
|------|------|
| 认证安全 | v1.1 |
| 性能基线 (p99<500ms) | v1.2 |
| 安全加固 (XSS/CSRF/限流) | v2.0 |
| WebSocket 实时推送 | v2.0 |
| 日志导出功能 | v1.1 |

## 七、架构决策记录 (ADR)

### ADR-001: 单 Pipeline vs 多 Pipeline
- **决策**: MVP 支持多 Pipeline 记录（每次执行创建一条 Pipeline），仅 Dashboard 默认显示"当前 Pipeline"
- **理由**: 数据模型本身支持多 Pipeline，额外的过滤成本极低；`GET /api/pipelines/current` 快速满足主场景

### ADR-002: 前端轮询 vs WebSocket
- **决策**: 前端使用 3 秒轮询
- **理由**: MVP 无需实时性；WebSocket 增加 Hono 配置复杂度

### ADR-003: Drizzle Schema 集中 vs 分散
- **决策**: Schema 集中在 `src/db/schema.ts`，模块的 `types.ts` 引用全局 Schema
- **理由**: 2 张表 + 2 个模块，集中管理更简单；后续表数 >5 时再拆分

### ADR-004: Metadata 存储格式
- **决策**: metadata 字段存储为 TEXT (JSON 字符串)
- **理由**: SQLite 无原生 JSONB；Drizzle 可以轻松序列化/反序列化；查询不需要在 metadata 内做索引

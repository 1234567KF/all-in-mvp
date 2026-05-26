# PRD: Pipeline Monitor MVP — all-in-mvp 流水线日志回溯系统

<!--
# @version: 1.0
# @last_modified: 2026-05-26T11:30:00Z
# @modified_by: pm-agent
# @change: 初版创建
# @grill_round: 0
# @status: DRAFT
-->

> 本文档描述 Pipeline Monitor MVP 的产品需求，遵循 MECE 原则，所有功能需求均附验收标准。

---

## 一、项目背景与目标

### 1.1 背景

`all-in-mvp` 是一个多 Agent 并行 MVP 开发流水线，涉及产品经理、架构专家、业务领域专家、Mock 服务专家、测试专家、后端 TDD Agent、前端 Agent、Pipeline Coordinator 等 10+ 个 Agent 角色。当前流水线执行过程中：

- **缺乏可见性**：用户无法实时了解流水线内部各 Agent 的执行状态、产出进度
- **缺乏可追溯性**：出现问题后难以回溯"哪个 Agent 在哪个步骤做了什么事"
- **缺乏度量能力**：无法量化各 Stage 的实际耗时、Agent 效率、瓶颈位置

### 1.2 目标

构建 **Pipeline Monitor**，一个轻量级流水线日志记录与回溯查看系统：

1. **记录**：自动采集流水线执行过程中的关键事件（Stage 变迁、Agent 启动/完成、文件变更、工具调用、异常）
2. **存储**：将事件持久化到 SQLite 数据库，支持按时间线回溯
3. **展示**：提供 Web Dashboard，以时间线 + 统计面板形式展示流水线执行全景
4. **自举**：本次 MVP 的建设过程本身，就是 Pipeline Monitor 的第一批真实数据

### 1.3 价值主张

| 用户角色 | 核心痛点 | 解决方案 |
|---------|---------|---------|
| 流水线用户（人类监督者） | 不知道 Agent 在做什么、做到哪了 | Dashboard 实时状态总览 |
| 流水线调试者 | Bug 出现后无法回溯 Agent 行为链 | 按时间线 + Agent + Stage 多维度过滤的事件日志 |
| 流程优化者 | 不知道哪个 Stage 是瓶颈 | 统计数据面板（各 Stage 耗时分布、Agent 效率） |

---

## 二、术语定义

| 术语 | 定义 |
|------|------|
| **Pipeline** | 一次完整的 `all-in-mvp` 流水线执行实例，从触发到交付 |
| **Stage** | 流水线阶段（Stage1/2/3/4/5），串行推进 |
| **Agent** | 执行具体任务的 AI 角色实例，如 `pm-agent`、`backend-tdd-1` |
| **Subagent** | 通过 Qoder `Agent` 工具 spawn 的子 Agent，如 `mvp-backend-tdd` |
| **Event** | 流水线中发生的可记录事件，是日志的最小单元 |
| **Event Type** | 事件类型枚举：`STAGE_START`、`STAGE_END`、`AGENT_SPAWN`、`AGENT_DONE`、`FILE_CHANGE`、`TOOL_CALL`、`ERROR`、`GATE_CHECK` |
| **Timeline** | 按时间排序的事件序列，是回溯查看的主要视图 |
| **Session** | 一次用户会话（对应一次 `/all-in-mvp` 触发），包含 1 条 Pipeline 记录 |
| **Metadata** | 事件附带的 JSON 扩展信息，存储事件特定字段 |

---

## 三、风险与约束

### 3.1 技术约束

| 约束 | 说明 |
|------|------|
| 技术栈绑定 | Hono + Drizzle + SQLite（后端）；Vue 3 + Vite（前端） |
| 零外部依赖 | 日志存储不依赖外部服务（如 Elasticsearch、Loki） |
| 单文件数据库 | SQLite 单文件，方便迁移和备份 |
| 浏览器端渲染 | 前端纯 CSR，无 SSR 要求 |

### 3.2 业务约束

| 约束 | 说明 |
|------|------|
| MVP 范围 | 仅记录和展示，不做告警、不做自动修复、不做实时推送（WebSocket） |
| 单 Pipeline | MVP 阶段仅支持单次流水线的记录和查看，不做多 Pipeline 对比 |
| 手动记录 | 事件记录依赖 Agent 在执行过程中主动调用日志 API（非自动 Hook 拦截） |

### 3.3 风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Agent 忘记写日志 | 高 | 日志不完整 | 提供极简的日志 SDK（一行调用），降低门槛 |
| 日志量爆炸 | 低 | DB 膨胀 | 设置单 Pipeline 最大事件数（10000），超限自动截断 |
| SQLite 并发写入 | 中 | 写入冲突 | 使用 WAL 模式，串行化写入 |
| 前端轮询压力 | 低 | 性能下降 | 设置轮询间隔 ≥2 秒 |

---

## 四、业务主流程

### 4.1 用户旅程 — 流水线执行监控

```
用户触发 /all-in-mvp 命令
  │
  ├─→ Pipeline Monitor 自动创建 Pipeline 记录（状态: RUNNING）
  │
  ├─→ Stage1 开始 → 写入 STAGE_START 事件
  │   ├─→ PM Agent 创建 → 写入 AGENT_SPAWN 事件
  │   ├─→ PRD.md 写入 → 写入 FILE_CHANGE 事件
  │   └─→ Stage1 完成 → 写入 STAGE_END 事件
  │
  ├─→ Stage2 开始 ...
  │   ├─→ 架构专家、业务专家、Grill → 各写入对应事件
  │   └─→ Stage2 完成
  │
  ├─→ Stage3 开始 → 并行执行
  │   ├─→ Coordinator 分配模块 → AGENT_SPAWN × N
  │   ├─→ 各 Agent TDD 循环 → FILE_CHANGE + TOOL_CALL
  │   └─→ Stage3 完成
  │
  ├─→ Stage4 开始 → 集成测试
  │   └─→ Stage4 完成 → Pipeline 状态: DONE
  │
  └─→ 用户打开 Dashboard 查看
      ├─→ 看到时间线视图（所有事件按时间排序）
      ├─→ 按 Stage/Agent/EventType 过滤
      └─→ 点击事件查看详情（Metadata JSON）
```

### 4.2 用户旅程 — 问题回溯

```
用户发现 Stage3 某个模块开发失败
  │
  ├─→ 打开 Dashboard
  ├─→ 过滤条件：Stage=Stage3, Agent=backend-tdd-2, EventType=ERROR
  ├─→ 时间线上看到 ERROR 事件
  ├─→ 点击事件查看详细 Metadata（错误信息、堆栈）
  ├─→ 向前回溯该 Agent 之前的 FILE_CHANGE 事件（定位是哪个文件改动引入问题）
  └─→ 确认根因
```

---

## 五、ER 关系 / 核心领域模型

### 5.1 实体关系图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Pipeline   │ 1───N │    Event     │ N───1 │  EventType   │
│              │       │              │       │  (枚举)       │
│ - id         │       │ - id         │       │              │
│ - name       │       │ - pipeline_id│       │ - code       │
│ - status     │       │ - event_type │       │ - label      │
│ - created_at │       │ - agent_name │       └──────────────┘
│ - updated_at │       │ - stage      │
└──────────────┘       │ - message    │
                       │ - metadata   │
                       │ - timestamp  │
                       └──────────────┘
```

### 5.2 实体说明

#### Pipeline（流水线实例）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 流水线名称（从 task 描述提取） |
| status | TEXT | RUNNING / DONE / FAILED / CANCELLED |
| mode | TEXT | full / incremental / simple |
| created_at | TEXT (ISO8601) | 创建时间 |
| updated_at | TEXT (ISO8601) | 最后更新时间 |

#### Event（流水线事件）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| pipeline_id | TEXT (FK) | 所属 Pipeline |
| event_type | TEXT | 事件类型枚举值 |
| agent_name | TEXT | 产生事件的 Agent 名称 |
| stage | TEXT | 所属 Stage（Stage1/2/3/4/5） |
| message | TEXT | 人类可读的事件描述 |
| metadata | TEXT (JSON) | 事件特定扩展数据 |
| timestamp | TEXT (ISO8601) | 事件发生时间 |
| seq | INTEGER | 事件序号（全局自增，用于排序） |

### 5.3 事件类型枚举

| event_type | 说明 | metadata 核心字段 |
|-----------|------|------------------|
| `PIPELINE_START` | 流水线启动 | `{mode, task_description}` |
| `PIPELINE_END` | 流水线结束 | `{status, duration_ms}` |
| `STAGE_START` | 阶段开始 | `{stage, expected_duration}` |
| `STAGE_END` | 阶段结束 | `{stage, actual_duration_ms, gate_result}` |
| `AGENT_SPAWN` | Agent/Subagent 启动 | `{agent_type, module, subagent_name}` |
| `AGENT_DONE` | Agent 完成任务 | `{agent_type, module, result}` |
| `AGENT_BLOCKED` | Agent 被阻塞 | `{agent_type, module, blocked_by, reason}` |
| `FILE_CHANGE` | 文件创建/修改 | `{file_path, operation, agent_name}` |
| `TOOL_CALL` | 工具调用 | `{tool_name, params_summary}` |
| `ERROR` | 错误/异常 | `{error_type, error_message, stack}` |
| `GATE_CHECK` | 门禁检查 | `{stage, gate_name, result, issues}` |
| `GRILL_ROUND` | 拷问审查轮次 | `{round, reviewer, target, result}` |

---

## 六、功能需求

### FR1: Pipeline 生命周期管理

| 编号 | 功能 | 验收标准 |
|------|------|---------|
| FR1.1 | 创建 Pipeline 记录 | `POST /api/pipelines` → 返回 Pipeline 对象，status=RUNNING |
| FR1.2 | 更新 Pipeline 状态 | `PATCH /api/pipelines/:id` → status 变更（RUNNING→DONE/FAILED/CANCELLED） |
| FR1.3 | 查询当前 Pipeline | `GET /api/pipelines/current` → 返回最新一条 Pipeline（按 created_at DESC） |

### FR2: 事件记录

| 编号 | 功能 | 验收标准 |
|------|------|---------|
| FR2.1 | 写入事件 | `POST /api/events` → 创建 Event 记录，自动关联当前 Pipeline，返回完整 Event 对象 |
| FR2.2 | 批量写入事件 | `POST /api/events/batch` → 接受 Event 数组，批量插入（用于减少 HTTP 往返） |
| FR2.3 | 事件必须包含 pipeline_id | 事件写入时自动关联当前活跃 Pipeline；若无活跃 Pipeline 返回 400 |

### FR3: 事件查询与过滤

| 编号 | 功能 | 验收标准 |
|------|------|---------|
| FR3.1 | 按时间线查询事件 | `GET /api/events?pipeline_id=xxx` → 按 seq ASC 返回事件列表，支持分页（page/pageSize） |
| FR3.2 | 按 Stage 过滤 | `GET /api/events?stage=Stage3` → 仅返回指定 Stage 的事件 |
| FR3.3 | 按 Agent 过滤 | `GET /api/events?agent_name=backend-tdd-1` → 仅返回指定 Agent 的事件 |
| FR3.4 | 按事件类型过滤 | `GET /api/events?event_type=ERROR` → 仅返回指定类型的事件 |
| FR3.5 | 组合过滤 | `GET /api/events?stage=Stage3&event_type=ERROR` → 多条件 AND 过滤 |
| FR3.6 | 按时间范围过滤 | `GET /api/events?from=xxx&to=xxx` → ISO8601 时间范围过滤 |
| FR3.7 | 搜索 | `GET /api/events?search=keyword` → 在 message 和 metadata 中模糊搜索 |

### FR4: 统计聚合

| 编号 | 功能 | 验收标准 |
|------|------|---------|
| FR4.1 | Pipeline 概览统计 | `GET /api/stats/overview?pipeline_id=xxx` → 返回 {total_events, stage_distribution, agent_distribution, event_type_distribution} |
| FR4.2 | Stage 耗时统计 | `GET /api/stats/stage-duration?pipeline_id=xxx` → 返回每个 Stage 的实际耗时（通过 STAGE_START/STAGE_END 时间差计算） |
| FR4.3 | Agent 活动统计 | `GET /api/stats/agent-activity?pipeline_id=xxx` → 返回每个 Agent 的事件数量、产出文件数 |

### FR5: Dashboard 前端

| 编号 | 功能 | 验收标准 |
|------|------|---------|
| FR5.1 | 总览面板 | Dashboard 首页显示：当前 Pipeline 状态、事件总数、Stage 进度条、Agent 状态列表 |
| FR5.2 | 时间线视图 | 按时间倒序/顺序展示事件列表，每条事件显示：时间、类型图标、Agent 名称、消息摘要 |
| FR5.3 | 过滤面板 | 侧边栏/顶部提供过滤器：Stage 下拉、Agent 下拉、Event Type 多选、时间范围选择器、关键词搜索框 |
| FR5.4 | 事件详情弹窗 | 点击事件行 → 弹出详情面板，展示完整事件信息 + 格式化 JSON metadata |
| FR5.5 | 统计图表 | Dashboard 底部展示：事件类型饼图、Stage 耗时柱状图、Agent 活跃度柱状图 |
| FR5.6 | 自动刷新 | Dashboard 每 3 秒自动拉取最新事件（仅在 Pipeline status=RUNNING 时），支持手动开关 |

---

## 七、核心实体状态图

### 7.1 Pipeline 状态机

```
    [触发命令]
        │
        ▼
    ┌─────────┐
    │ RUNNING │──────────────正常完成──────→ [DONE]
    └────┬────┘
         │
         ├─── 异常终止 ──→ [FAILED]
         │
         └─── 用户取消 ──→ [CANCELLED]
```

### 7.2 Event 生命周期

```
    [Agent 执行动作]
        │
        ▼
    ┌─────────┐
    │ CREATED │  （写入后即不可变，Event 是只追加的日志）
    └─────────┘
```

> Event 无状态流转——一旦写入即为不可变记录，符合"日志"本质。

---

## 八、验收标准（集成测试场景）

### 8.1 Happy Path 场景

| 场景 | 步骤 | 预期结果 |
|------|------|---------|
| 完整流水线日志采集 | 1. 创建 Pipeline → 2. 按顺序写入所有 Stage/Agent/File 事件 → 3. 查询时间线 | 所有事件按 seq 排序完整展示 |
| Dashboard 实时监控 | 1. Pipeline RUNNING → 2. 打开 Dashboard → 3. Agent 持续写入事件 | Dashboard 每 3 秒自动刷新显示最新事件 |
| 问题回溯 | 1. 写入若干事件（含 1 个 ERROR）→ 2. 前端按 event_type=ERROR 过滤 | 仅显示 ERROR 事件，点击可查看详情 |

### 8.2 Exception Path 场景

| 场景 | 步骤 | 预期结果 |
|------|------|---------|
| 无活跃 Pipeline 时写入事件 | POST /api/events 但无 RUNNING 状态的 Pipeline | 返回 400，错误信息："No active pipeline" |
| 查询不存在的 Pipeline | GET /api/events?pipeline_id=nonexistent | 返回空列表 []，非 404 |
| 事件写入超最大限制 | 写入第 10001 条事件 | 返回 400，错误信息："Event limit exceeded (max: 10000)" |
| 批量写入部分失败 | POST /api/events/batch，其中一条数据缺 event_type | 返回 400，事务回滚，无任何事件写入 |

---

## 九、明确的"不做"清单

| 序号 | 不做内容 | 原因 |
|------|---------|------|
| 1 | 多 Pipeline 对比分析 | MVP 阶段仅支持单 Pipeline 查看，后续迭代补充 |
| 2 | WebSocket 实时推送 | MVP 使用轮询（3s），降低复杂度 |
| 3 | 自动 Hook 拦截（拦截 Agent 工具调用） | 需要深度集成 Qoder IDE 内部机制，MVP 采用手动调用日志 API 方式 |
| 4 | 告警/通知（钉钉、邮件等） | 后续迭代补充 |
| 5 | 用户认证/权限 | MVP 为本地单用户工具 |
| 6 | 日志导出（CSV/PDF） | 后续迭代补充 |
| 7 | 日志清理/归档策略 | MVP 阶段 SQLite 单文件足够 |
| 8 | 性能监控（Agent 内存/CPU 消耗） | 超出 MVP 范围 |
| 9 | 前端 E2E 测试（Playwright） | MVP 仅做后端 API 测试 + 前端手动验收 |
| 10 | 响应式移动端适配 | MVP 仅适配桌面端（≥1280px） |

---

## 十、PRD 质量门禁自检

| 门禁项 | 状态 | 说明 |
|--------|------|------|
| 章节完整性 | ✅ | 10 个章节全部非空 |
| 功能需求可测试性 | ✅ | 每条 FR 均可转化为 API 测试 |
| ER 关系一致性 | ✅ | Pipeline 1:N Event，Event 引用 event_type 枚举 |
| 术语自洽 | ✅ | Pipeline/Event/Stage/Agent 全文档一致 |
| 验收标准覆盖 | ✅ | 3 Happy Path + 4 Exception Path |
| 范围边界清晰 | ✅ | "不做"清单 10 项 |

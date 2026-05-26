# Task: Pipeline Monitor MVP — 任务全景图
<!-- @version: 1.0.draft -->
<!-- @status: DRAFT -->

> 本文档定义所有模块清单、依赖关系和分配策略。

---

## 模块清单

| 序号 | 模块名 | 领域 | 依赖 | 接口数 | 表数 | 预估代码行数 |
|------|--------|------|------|--------|------|-------------|
| 1 | pipeline | 工具与配置 | 无 | 3 | 1 (pipelines) | 150-250 |
| 2 | event | 业务核心 | pipeline | 6 | 1 (events) | 300-500 |
| 3 | frontend | 前端展示 | pipeline, event | — | — | 400-600 |

## 依赖关系图

```
pipeline (无依赖)
    │
    ▼
event (依赖 pipeline — 事件必须关联 pipeline_id)
    │
    ▼
frontend (依赖 pipeline 和 event — 通过 API 调用)
```

## 分配策略

| 轮次 | 模块 | Agent | 类型 |
|------|------|-------|------|
| 第 1 轮 | pipeline | Backend-3 (工具与配置) | 后端 |
| 第 2 轮 | event | Backend-2 (业务核心) | 后端 |
| 第 2 轮 | frontend | Frontend-1 | 前端 |

> pipeline → event 串行（event 依赖 pipeline）；pipeline 完成后，event 和 frontend 可并行启动（frontend 依赖 pipeline API + event API，但开发时可使用 Mock）

---

## 模块详细定义

参见：
- [modules/pipeline.md](./modules/pipeline.md) — Pipeline 管理模块
- [modules/event.md](./modules/event.md) — Event 事件模块
- [modules/frontend.md](./modules/frontend.md) — 前端 Dashboard

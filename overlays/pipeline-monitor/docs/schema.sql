-- Pipeline Monitor MVP — 数据库 Schema
-- @version: 1.0.draft
-- @status: DRAFT
-- @atomic_group: pipeline_group (pipelines)
-- @atomic_group: event_group (events)

-- ============================================================
-- 表 1: pipelines — 流水线实例
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
    id          TEXT PRIMARY KEY,                              -- UUID
    name        TEXT NOT NULL DEFAULT 'Unnamed Pipeline',      -- 流水线名称
    status      TEXT NOT NULL DEFAULT 'RUNNING',               -- RUNNING / DONE / FAILED / CANCELLED
    mode        TEXT NOT NULL DEFAULT 'full',                  -- full / incremental / simple
    task_desc   TEXT NOT NULL DEFAULT '',                      -- 任务描述
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),       -- ISO8601
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))        -- ISO8601
);

-- 索引：按创建时间排序（查询当前 Pipeline）
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at DESC);

-- 索引：按状态过滤
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);

-- ============================================================
-- 表 2: events — 流水线事件日志
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,                              -- UUID
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id),        -- 所属 Pipeline
    event_type  TEXT NOT NULL,                                 -- 事件类型枚举
    agent_name  TEXT NOT NULL DEFAULT '',                      -- Agent 名称
    stage       TEXT NOT NULL DEFAULT '',                      -- Stage1/2/3/4/5
    message     TEXT NOT NULL DEFAULT '',                      -- 人类可读描述
    metadata    TEXT NOT NULL DEFAULT '{}',                    -- JSON 扩展数据
    timestamp   TEXT NOT NULL DEFAULT (datetime('now')),       -- ISO8601
    seq         INTEGER NOT NULL                               -- 全局自增序号
);

-- 索引：按 pipeline_id + seq 排序（时间线查询）
CREATE INDEX IF NOT EXISTS idx_events_pipeline_seq ON events(pipeline_id, seq);

-- 索引：按 stage 过滤
CREATE INDEX IF NOT EXISTS idx_events_stage ON events(pipeline_id, stage);

-- 索引：按 agent_name 过滤
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(pipeline_id, agent_name);

-- 索引：按 event_type 过滤
CREATE INDEX IF NOT EXISTS idx_events_type ON events(pipeline_id, event_type);

-- 索引：按时间戳范围过滤
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(pipeline_id, timestamp);

-- ============================================================
-- 约束说明
-- ============================================================
-- event_type 合法值（应用层校验）：
--   PIPELINE_START, PIPELINE_END,
--   STAGE_START, STAGE_END,
--   AGENT_SPAWN, AGENT_DONE, AGENT_BLOCKED,
--   FILE_CHANGE, TOOL_CALL,
--   ERROR, GATE_CHECK, GRILL_ROUND
--
-- pipeline status 合法值（应用层校验）：
--   RUNNING, DONE, FAILED, CANCELLED

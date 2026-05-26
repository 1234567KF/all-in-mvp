/**
 * Mock Data — Pipeline Monitor MVP
 *
 * Contains:
 *  - 1 mock pipeline (RUNNING state)
 *  - 25 mock events covering all event types, stages, and agents
 *  - Both happy-path and error-path scenarios
 */

import type { Pipeline, Event } from "./types.js";

// ─── Pipeline ────────────────────────────────────────────────────────────────

export const mockPipeline: Pipeline = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "MVP Pipeline Monitor — 全流程构建",
  status: "RUNNING",
  mode: "full",
  task_desc:
    "构建流水线监控系统MVP版本：实现Pipeline生命周期管理、事件日志记录、统计分析与前端Dashboard可视化",
  created_at: "2026-05-26T08:00:00.000Z",
  updated_at: "2026-05-26T09:30:00.000Z",
};

// ─── Events (25 sample events) ──────────────────────────────────────────────

const BASE_TIME = "2026-05-26T";

export const mockEvents: Event[] = [
  // 1. PIPELINE_START
  {
    id: "evt-00000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    pipeline_id: mockPipeline.id,
    event_type: "PIPELINE_START",
    agent_name: "",
    stage: "",
    message: "Pipeline 启动：MVP Pipeline Monitor 全流程构建",
    metadata: { mode: "full", trigger: "manual" },
    timestamp: `${BASE_TIME}08:00:00.000Z`,
    seq: 1,
  },

  // 2. STAGE_START — Stage1 (需求分析)
  {
    id: "evt-00000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_START",
    agent_name: "",
    stage: "Stage1",
    message: "Stage1 开始：需求分析与任务拆解",
    metadata: { stage_index: 1, stage_name: "需求分析" },
    timestamp: `${BASE_TIME}08:02:00.000Z`,
    seq: 2,
  },

  // 3. AGENT_SPAWN — pm-agent
  {
    id: "evt-00000003-cccc-4ccc-cccc-cccccccccccc",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_SPAWN",
    agent_name: "pm-agent",
    stage: "Stage1",
    message: "Agent pm-agent 已启动，开始需求分析",
    metadata: { agent_type: "product-manager", spawn_ms: 120 },
    timestamp: `${BASE_TIME}08:03:00.000Z`,
    seq: 3,
  },

  // 4. TOOL_CALL — pm-agent
  {
    id: "evt-00000004-dddd-4ddd-dddd-dddddddddddd",
    pipeline_id: mockPipeline.id,
    event_type: "TOOL_CALL",
    agent_name: "pm-agent",
    stage: "Stage1",
    message: "pm-agent 调用 read_file 读取现有文档",
    metadata: { tool: "read_file", target: "docs/spec.md", duration_ms: 45 },
    timestamp: `${BASE_TIME}08:04:30.000Z`,
    seq: 4,
  },

  // 5. FILE_CHANGE — pm-agent 创建需求文档
  {
    id: "evt-00000005-eeee-4eee-eeee-eeeeeeeeeeee",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "pm-agent",
    stage: "Stage1",
    message: "pm-agent 创建 docs/modules/pipeline.md (需求文档)",
    metadata: {
      file: "docs/modules/pipeline.md",
      operation: "create",
      lines_added: 85,
    },
    timestamp: `${BASE_TIME}08:12:00.000Z`,
    seq: 5,
  },

  // 6. FILE_CHANGE — pm-agent 创建更多文档
  {
    id: "evt-00000006-ffff-4fff-ffff-ffffffffffff",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "pm-agent",
    stage: "Stage1",
    message: "pm-agent 创建 docs/modules/event.md (模块定义)",
    metadata: {
      file: "docs/modules/event.md",
      operation: "create",
      lines_added: 62,
    },
    timestamp: `${BASE_TIME}08:18:00.000Z`,
    seq: 6,
  },

  // 7. GATE_CHECK — Stage1 门禁
  {
    id: "evt-00000007-1111-4111-1111-111111111111",
    pipeline_id: mockPipeline.id,
    event_type: "GATE_CHECK",
    agent_name: "",
    stage: "Stage1",
    message: "Stage1 门禁检查：需求文档完整性验证通过",
    metadata: { checks: 5, passed: 5, failed: 0 },
    timestamp: `${BASE_TIME}08:25:00.000Z`,
    seq: 7,
  },

  // 8. STAGE_END — Stage1 完成
  {
    id: "evt-00000008-2222-4222-2222-222222222222",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_END",
    agent_name: "",
    stage: "Stage1",
    message: "Stage1 完成：需求分析耗时 23 分钟",
    metadata: { duration_ms: 1380000, files_changed: 4 },
    timestamp: `${BASE_TIME}08:25:30.000Z`,
    seq: 8,
  },

  // 9. STAGE_START — Stage2 (架构设计)
  {
    id: "evt-00000009-3333-4333-3333-333333333333",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_START",
    agent_name: "",
    stage: "Stage2",
    message: "Stage2 开始：架构设计与技术方案",
    metadata: { stage_index: 2, stage_name: "架构设计" },
    timestamp: `${BASE_TIME}08:26:00.000Z`,
    seq: 9,
  },

  // 10. AGENT_SPAWN — architect
  {
    id: "evt-00000010-4444-4444-4444-444444444444",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_SPAWN",
    agent_name: "architect",
    stage: "Stage2",
    message: "Agent architect 已启动，开始架构方案设计",
    metadata: { agent_type: "architect", spawn_ms: 95 },
    timestamp: `${BASE_TIME}08:27:00.000Z`,
    seq: 10,
  },

  // 11. FILE_CHANGE — architect
  {
    id: "evt-00000011-5555-4555-5555-555555555555",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "architect",
    stage: "Stage2",
    message: "architect 创建 docs/api-contract.yaml",
    metadata: {
      file: "docs/api-contract.yaml",
      operation: "create",
      lines_added: 331,
    },
    timestamp: `${BASE_TIME}08:35:00.000Z`,
    seq: 11,
  },

  // 12. TOOL_CALL — architect
  {
    id: "evt-00000012-6666-4666-6666-666666666666",
    pipeline_id: mockPipeline.id,
    event_type: "TOOL_CALL",
    agent_name: "architect",
    stage: "Stage2",
    message: "architect 调用 search_codebase 检索最佳实践",
    metadata: { tool: "search_codebase", query: "hono middleware pattern", duration_ms: 230 },
    timestamp: `${BASE_TIME}08:38:00.000Z`,
    seq: 12,
  },

  // 13. GRILL_ROUND — 架构评审
  {
    id: "evt-00000013-7777-4777-7777-777777777777",
    pipeline_id: mockPipeline.id,
    event_type: "GRILL_ROUND",
    agent_name: "",
    stage: "Stage2",
    message: "架构评审 Grilling：验证 API 设计与数据模型的一致性",
    metadata: { reviewer: "pm-agent", issues_found: 2, issues_resolved: 2 },
    timestamp: `${BASE_TIME}08:45:00.000Z`,
    seq: 13,
  },

  // 14. AGENT_DONE — architect
  {
    id: "evt-00000014-8888-4888-8888-888888888888",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_DONE",
    agent_name: "architect",
    stage: "Stage2",
    message: "Agent architect 完成任务：API 契约与数据库 Schema 已锁定",
    metadata: { files_created: 3, total_lines: 450 },
    timestamp: `${BASE_TIME}08:50:00.000Z`,
    seq: 14,
  },

  // 15. STAGE_END — Stage2 完成
  {
    id: "evt-00000015-9999-4999-9999-999999999999",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_END",
    agent_name: "",
    stage: "Stage2",
    message: "Stage2 完成：架构设计耗时 24 分钟",
    metadata: { duration_ms: 1440000, deliverables: ["api-contract.yaml", "schema.sql"] },
    timestamp: `${BASE_TIME}08:50:30.000Z`,
    seq: 15,
  },

  // 16. STAGE_START — Stage3 (后端开发)
  {
    id: "evt-00000016-aaaa-4aaa-bbbb-aaaaaaaaaaaa",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_START",
    agent_name: "",
    stage: "Stage3",
    message: "Stage3 开始：后端 API 开发",
    metadata: { stage_index: 3, stage_name: "后端开发" },
    timestamp: `${BASE_TIME}08:51:00.000Z`,
    seq: 16,
  },

  // 17. AGENT_SPAWN — backend-tdd-1
  {
    id: "evt-00000017-bbbb-4bbb-cccc-bbbbbbbbbbbb",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_SPAWN",
    agent_name: "backend-tdd-1",
    stage: "Stage3",
    message: "Agent backend-tdd-1 已启动，开始 Pipeline 模块开发",
    metadata: { agent_type: "backend-tdd", module: "pipeline", spawn_ms: 135 },
    timestamp: `${BASE_TIME}08:52:00.000Z`,
    seq: 17,
  },

  // 18. AGENT_SPAWN — backend-tdd-2 (并行)
  {
    id: "evt-00000018-cccc-4ccc-dddd-cccccccccccc",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_SPAWN",
    agent_name: "backend-tdd-2",
    stage: "Stage3",
    message: "Agent backend-tdd-2 已启动，开始 Event 模块开发",
    metadata: { agent_type: "backend-tdd", module: "event", spawn_ms: 128 },
    timestamp: `${BASE_TIME}08:53:00.000Z`,
    seq: 18,
  },

  // 19. FILE_CHANGE — backend-tdd-1
  {
    id: "evt-00000019-dddd-4ddd-eeee-dddddddddddd",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "backend-tdd-1",
    stage: "Stage3",
    message: "backend-tdd-1 创建 src/pipeline/routes.ts",
    metadata: {
      file: "src/pipeline/routes.ts",
      operation: "create",
      lines_added: 95,
    },
    timestamp: `${BASE_TIME}09:00:00.000Z`,
    seq: 19,
  },

  // 20. ERROR — test 失败
  {
    id: "evt-00000020-eeee-4eee-ffff-eeeeeeeeeeee",
    pipeline_id: mockPipeline.id,
    event_type: "ERROR",
    agent_name: "backend-tdd-1",
    stage: "Stage3",
    message: "测试失败：POST /api/pipelines 返回 400，缺少 name 字段校验",
    metadata: {
      error_type: "test_failure",
      test_file: "tests/pipeline.test.ts",
      line: 42,
      expected: 201,
      actual: 400,
    },
    timestamp: `${BASE_TIME}09:10:00.000Z`,
    seq: 20,
  },

  // 21. ERROR — 修复后仍有问题
  {
    id: "evt-00000021-ffff-4fff-aaaa-ffffffffffff",
    pipeline_id: mockPipeline.id,
    event_type: "ERROR",
    agent_name: "backend-tdd-2",
    stage: "Stage3",
    message: "数据库迁移失败：events 表外键约束冲突",
    metadata: {
      error_type: "db_migration",
      table: "events",
      constraint: "fk_pipeline_id",
      sql_state: "23503",
    },
    timestamp: `${BASE_TIME}09:15:00.000Z`,
    seq: 21,
  },

  // 22. FILE_CHANGE — backend-tdd-2 修复
  {
    id: "evt-00000022-1111-4111-2222-111111111112",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "backend-tdd-2",
    stage: "Stage3",
    message: "backend-tdd-2 修复 src/event/routes.ts 中的外键处理逻辑",
    metadata: {
      file: "src/event/routes.ts",
      operation: "update",
      lines_added: 12,
      lines_removed: 3,
    },
    timestamp: `${BASE_TIME}09:18:00.000Z`,
    seq: 22,
  },

  // 23. AGENT_BLOCKED — backend-tdd-2 被阻塞
  {
    id: "evt-00000023-2222-4222-3333-222222222223",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_BLOCKED",
    agent_name: "backend-tdd-2",
    stage: "Stage3",
    message: "backend-tdd-2 等待 backend-tdd-1 完成 Pipeline 模块以便集成测试",
    metadata: {
      blocked_by: "backend-tdd-1",
      reason: "integration_dependency",
      blocked_since: "2026-05-26T09:20:00.000Z",
    },
    timestamp: `${BASE_TIME}09:20:00.000Z`,
    seq: 23,
  },

  // 24. AGENT_DONE — backend-tdd-1
  {
    id: "evt-00000024-3333-4333-4444-333333333334",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_DONE",
    agent_name: "backend-tdd-1",
    stage: "Stage3",
    message: "Agent backend-tdd-1 完成 Pipeline 模块（3 个端点，含单元测试）",
    metadata: {
      files_created: 5,
      total_lines: 320,
      tests_passed: 12,
      tests_total: 12,
    },
    timestamp: `${BASE_TIME}09:25:00.000Z`,
    seq: 24,
  },

  // 25. STAGE_END — Stage3 完成
  {
    id: "evt-00000025-4444-4444-5555-444444444445",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_END",
    agent_name: "",
    stage: "Stage3",
    message: "Stage3 完成：后端开发耗时 34 分钟",
    metadata: { duration_ms: 2040000, modules: ["pipeline", "event"], errors_resolved: 2 },
    timestamp: `${BASE_TIME}09:25:30.000Z`,
    seq: 25,
  },

  // 26. STAGE_START — Stage4 (前端开发)
  {
    id: "evt-00000026-5555-4555-6666-555555555556",
    pipeline_id: mockPipeline.id,
    event_type: "STAGE_START",
    agent_name: "",
    stage: "Stage4",
    message: "Stage4 开始：前端 Dashboard 开发",
    metadata: { stage_index: 4, stage_name: "前端开发" },
    timestamp: `${BASE_TIME}09:26:00.000Z`,
    seq: 26,
  },

  // 27. AGENT_SPAWN — frontend-1
  {
    id: "evt-00000027-6666-4666-7777-666666666667",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_SPAWN",
    agent_name: "frontend-1",
    stage: "Stage4",
    message: "Agent frontend-1 已启动，开始 Dashboard UI 开发",
    metadata: { agent_type: "frontend", framework: "react", spawn_ms: 110 },
    timestamp: `${BASE_TIME}09:27:00.000Z`,
    seq: 27,
  },

  // 28. FILE_CHANGE — frontend-1
  {
    id: "evt-00000028-7777-4777-8888-777777777778",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "frontend-1",
    stage: "Stage4",
    message: "frontend-1 创建 src/components/PipelineTimeline.tsx",
    metadata: {
      file: "src/components/PipelineTimeline.tsx",
      operation: "create",
      lines_added: 180,
    },
    timestamp: `${BASE_TIME}09:40:00.000Z`,
    seq: 28,
  },

  // 29. FILE_CHANGE — frontend-1 统计面板
  {
    id: "evt-00000029-8888-4888-9999-888888888889",
    pipeline_id: mockPipeline.id,
    event_type: "FILE_CHANGE",
    agent_name: "frontend-1",
    stage: "Stage4",
    message: "frontend-1 创建 src/components/StatsPanel.tsx",
    metadata: {
      file: "src/components/StatsPanel.tsx",
      operation: "create",
      lines_added: 145,
    },
    timestamp: `${BASE_TIME}09:50:00.000Z`,
    seq: 29,
  },

  // 30. AGENT_DONE — frontend-1 (当前最后一条)
  {
    id: "evt-00000030-9999-4999-0000-999999999990",
    pipeline_id: mockPipeline.id,
    event_type: "AGENT_DONE",
    agent_name: "frontend-1",
    stage: "Stage4",
    message: "Agent frontend-1 完成 Dashboard 组件开发（含 Mock 集成）",
    metadata: {
      files_created: 4,
      total_lines: 520,
      components: ["PipelineTimeline", "StatsPanel", "EventFilter", "DashboardLayout"],
    },
    timestamp: `${BASE_TIME}09:55:00.000Z`,
    seq: 30,
  },
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Deep-clone the mock pipeline (to avoid mutations) */
export function getFreshPipeline(): Pipeline {
  return JSON.parse(JSON.stringify(mockPipeline));
}

/** Deep-clone all mock events */
export function getFreshEvents(): Event[] {
  return JSON.parse(JSON.stringify(mockEvents));
}

/** All distinct stages found in mock events */
export const ALL_STAGES = ["Stage1", "Stage2", "Stage3", "Stage4"] as const;

/** All distinct agents found in mock events */
export const ALL_AGENTS = [
  "pm-agent",
  "architect",
  "backend-tdd-1",
  "backend-tdd-2",
  "frontend-1",
] as const;

/** All distinct event types found in mock events */
export const ALL_EVENT_TYPES = [
  "PIPELINE_START",
  "PIPELINE_END",
  "STAGE_START",
  "STAGE_END",
  "AGENT_SPAWN",
  "AGENT_DONE",
  "AGENT_BLOCKED",
  "FILE_CHANGE",
  "TOOL_CALL",
  "ERROR",
  "GATE_CHECK",
  "GRILL_ROUND",
] as const;

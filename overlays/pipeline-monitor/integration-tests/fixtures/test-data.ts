/**
 * 共享测试数据 — Pipeline Monitor MVP E2E Tests
 *
 * 定义所有 E2E 场景测试中使用的常量、枚举和测试数据工厂函数。
 * 各测试文件引用此模块以确保数据一致性。
 */

// ════════════════════════════════════════════════════════
// 枚举常量
// ════════════════════════════════════════════════════════

/** 流水线阶段列表 */
export const ALL_STAGES = ['Stage1', 'Stage2', 'Stage3', 'Stage4', 'Stage5'] as const;
export type Stage = (typeof ALL_STAGES)[number];

/** 事件类型枚举（与 API 契约一致） */
export const EVENT_TYPES = [
  'PIPELINE_START',
  'PIPELINE_END',
  'STAGE_START',
  'STAGE_END',
  'AGENT_SPAWN',
  'AGENT_DONE',
  'AGENT_BLOCKED',
  'FILE_CHANGE',
  'TOOL_CALL',
  'ERROR',
  'GATE_CHECK',
  'GRILL_ROUND',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Pipeline 状态枚举 */
export const PIPELINE_STATUS = ['RUNNING', 'DONE', 'FAILED', 'CANCELLED'] as const;
export type PipelineStatus = (typeof PIPELINE_STATUS)[number];

/** Pipeline 模式枚举 */
export const PIPELINE_MODES = ['full', 'incremental', 'simple'] as const;
export type PipelineMode = (typeof PIPELINE_MODES)[number];

// ════════════════════════════════════════════════════════
// MVP Agent 定义（真实流水线中的 Agent 角色）
// ════════════════════════════════════════════════════════

export interface AgentDef {
  name: string;
  stage: string;
  type: string;
}

/** 典型 MVP 流水线中的所有 Agent */
export const MVP_AGENTS: AgentDef[] = [
  { name: 'pm-agent', stage: 'Stage1', type: 'pm' },
  { name: 'arch-expert', stage: 'Stage2', type: 'architect' },
  { name: 'domain-expert', stage: 'Stage2', type: 'domain' },
  { name: 'grill-agent', stage: 'Stage2', type: 'grill' },
  { name: 'coordinator', stage: 'Stage3', type: 'coordinator' },
  { name: 'backend-tdd-1', stage: 'Stage3', type: 'backend-tdd' },
  { name: 'backend-tdd-2', stage: 'Stage3', type: 'backend-tdd' },
  { name: 'backend-tdd-3', stage: 'Stage3', type: 'backend-tdd' },
  { name: 'frontend-agent', stage: 'Stage3', type: 'frontend' },
  { name: 'mock-service-expert', stage: 'Stage3', type: 'mock' },
  { name: 'test-expert', stage: 'Stage4', type: 'test' },
];

// ════════════════════════════════════════════════════════
// 典型文件产出定义
// ════════════════════════════════════════════════════════

export interface FileOutput {
  path: string;
  agent: string;
  stage: string;
}

/** MVP 流水线各阶段典型产出文件 */
export const TYPICAL_FILES: FileOutput[] = [
  { path: 'docs/PRD.md', agent: 'pm-agent', stage: 'Stage1' },
  { path: 'docs/architecture.md', agent: 'arch-expert', stage: 'Stage2' },
  { path: 'docs/domain-model.md', agent: 'domain-expert', stage: 'Stage2' },
  { path: 'docs/grill-report.md', agent: 'grill-agent', stage: 'Stage2' },
  { path: 'docs/task.md', agent: 'coordinator', stage: 'Stage3' },
  { path: 'docs/api-contract.yaml', agent: 'coordinator', stage: 'Stage3' },
  { path: 'src/modules/pipeline/index.ts', agent: 'backend-tdd-1', stage: 'Stage3' },
  { path: 'src/modules/event/index.ts', agent: 'backend-tdd-2', stage: 'Stage3' },
  { path: 'frontend/src/App.vue', agent: 'frontend-agent', stage: 'Stage3' },
  { path: 'integration-tests/e2e.test.ts', agent: 'test-expert', stage: 'Stage4' },
];

// ════════════════════════════════════════════════════════
// 错误场景测试数据
// ════════════════════════════════════════════════════════

/** 模拟的 CONTRACT_MISMATCH 错误 */
export const CONTRACT_MISMATCH_ERROR = {
  error_type: 'CONTRACT_MISMATCH',
  error_message: 'API response does not match contract: missing field "seq" in Event response',
  stack:
    'Error: CONTRACT_MISMATCH\n    at validateResponse (event-validator.ts:42)\n    at processEvent (event-service.ts:156)',
  code_context: 'event-validator.ts:42 — schema.parse(response)',
};

export const ERROR_AGENT_NAME = 'backend-tdd-2';
export const ERROR_STAGE = 'Stage3';

// ════════════════════════════════════════════════════════
// 工厂函数
// ════════════════════════════════════════════════════════

export function makePipelinePayload(
  name: string,
  overrides?: Partial<{ mode: PipelineMode; task_desc: string }>,
) {
  return {
    name,
    mode: (overrides?.mode ?? 'full') as string,
    task_desc: overrides?.task_desc ?? 'E2E test pipeline',
  };
}

export function makeEventPayload(
  event_type: EventType,
  overrides?: Partial<{
    agent_name: string;
    stage: string;
    message: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return {
    event_type,
    agent_name: overrides?.agent_name ?? '',
    stage: overrides?.stage ?? '',
    message: overrides?.message ?? `Event: ${event_type}`,
    metadata: overrides?.metadata ?? {},
  };
}

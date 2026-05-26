/**
 * E2E Scenario: 问题回溯 — 错误追踪与过滤
 * 基于 PRD Section 4.2 (问题回溯) + Section 8.1 HP3
 *
 * 覆盖：正常事件 → ERROR 事件写入 → 按 event_type/agent/search 过滤 → 确认错误可被精确追溯
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:3000';

// ── 类型定义 ──────────────────────────────────────────────
interface Pipeline {
  id: string;
  name: string;
  status: string;
}

interface Event {
  id: string;
  pipeline_id: string;
  event_type: string;
  agent_name: string;
  stage: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  seq: number;
}

interface EventListResponse {
  data: Event[];
  total: number;
  page: number;
  pageSize: number;
}

interface ErrorResponse {
  error: string;
  message: string;
}

// ── 辅助函数 ──────────────────────────────────────────────
async function post<T>(url: string, body: Record<string, unknown>): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as T };
}

async function get<T>(url: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${url}`);
  return { status: res.status, data: await res.json() as T };
}

// ── 错误事件的元数据 ──────────────────────────────────────
const ERROR_METADATA = {
  error_type: 'CONTRACT_MISMATCH',
  error_message: 'API response does not match contract: missing field "seq" in Event response',
  stack: 'Error: CONTRACT_MISMATCH\n    at validateResponse (event-validator.ts:42)\n    at processEvent (event-service.ts:156)',
  code_context: 'event-validator.ts:42 — schema.parse(response)',
};

const ERROR_AGENT_NAME = 'backend-tdd-2';
const ERROR_STAGE = 'Stage3';

// ── 测试套件 ──────────────────────────────────────────────
describe('Error Traceability E2E', () => {
  let pipelineId: string;
  let errorEventId: string;

  // ════════════════════════════════════════════════════════
  // Step 1: 创建 Pipeline
  // ════════════════════════════════════════════════════════
  describe('Setup: Create Pipeline', () => {
    it('should create a Pipeline for error traceability testing', async () => {
      const { status, data } = await post<Pipeline>('/api/pipelines', {
        name: 'E2E Error Traceability Test',
        mode: 'full',
        task_desc: 'Testing error traceability and filtering',
      });

      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(data.status).toBe('RUNNING');

      pipelineId = data.id;
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 2: 写入 10 条正常事件（为 ERROR 事件建立上下文）
  // ════════════════════════════════════════════════════════
  describe('Step 2: Write 10 normal events before error', () => {
    const NORMAL_EVENTS = [
      { event_type: 'PIPELINE_START', agent_name: 'system', stage: '', message: 'Pipeline started' },
      { event_type: 'STAGE_START', agent_name: 'coordinator', stage: 'Stage1', message: 'Stage1 started' },
      { event_type: 'AGENT_SPAWN', agent_name: 'pm-agent', stage: 'Stage1', message: 'PM Agent spawned' },
      { event_type: 'FILE_CHANGE', agent_name: 'pm-agent', stage: 'Stage1', message: 'PRD.md created' },
      { event_type: 'STAGE_END', agent_name: 'coordinator', stage: 'Stage1', message: 'Stage1 completed' },
      { event_type: 'STAGE_START', agent_name: 'coordinator', stage: 'Stage2', message: 'Stage2 started' },
      { event_type: 'AGENT_SPAWN', agent_name: 'arch-expert', stage: 'Stage2', message: 'Arch expert spawned' },
      { event_type: 'AGENT_SPAWN', agent_name: 'domain-expert', stage: 'Stage2', message: 'Domain expert spawned' },
      { event_type: 'FILE_CHANGE', agent_name: 'arch-expert', stage: 'Stage2', message: 'architecture.md created' },
      { event_type: 'STAGE_END', agent_name: 'coordinator', stage: 'Stage2', message: 'Stage2 completed' },
    ];

    it('should write 10 normal events successfully', async () => {
      for (const evt of NORMAL_EVENTS) {
        const { status, data } = await post<Event>('/api/events', {
          event_type: evt.event_type,
          agent_name: evt.agent_name,
          stage: evt.stage,
          message: evt.message,
          metadata: {},
        });

        expect(status).toBe(201);
        expect(data.pipeline_id).toBe(pipelineId);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 3: 写入 ERROR 事件（模拟 Stage3 中 backend-tdd-2 的契约不匹配错误）
  // ════════════════════════════════════════════════════════
  describe('Step 3: Write ERROR event (CONTRACT_MISMATCH)', () => {
    it('should write ERROR event with detailed metadata', async () => {
      const { status, data } = await post<Event>('/api/events', {
        event_type: 'ERROR',
        agent_name: ERROR_AGENT_NAME,
        stage: ERROR_STAGE,
        message: `Contract mismatch detected: ${ERROR_METADATA.error_message}`,
        metadata: ERROR_METADATA,
      });

      expect(status).toBe(201);
      expect(data.event_type).toBe('ERROR');
      expect(data.agent_name).toBe(ERROR_AGENT_NAME);
      expect(data.stage).toBe(ERROR_STAGE);
      expect(data.pipeline_id).toBe(pipelineId);

      // 验证 metadata 被完整保存
      const meta = data.metadata as Record<string, unknown>;
      expect(meta.error_type).toBe('CONTRACT_MISMATCH');
      expect(meta.stack).toBeTruthy();

      errorEventId = data.id;
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 4: 在错误之后写入 5 条正常事件
  // ════════════════════════════════════════════════════════
  describe('Step 4: Write 5 normal events after error', () => {
    const POST_ERROR_EVENTS = [
      { event_type: 'AGENT_SPAWN', agent_name: 'backend-tdd-3', stage: 'Stage3', message: 'Backup TDD agent spawned' },
      { event_type: 'FILE_CHANGE', agent_name: 'backend-tdd-3', stage: 'Stage3', message: 'Fix applied: event.ts' },
      { event_type: 'STAGE_END', agent_name: 'coordinator', stage: 'Stage3', message: 'Stage3 completed (with retry)' },
      { event_type: 'STAGE_START', agent_name: 'coordinator', stage: 'Stage4', message: 'Stage4 started' },
      { event_type: 'PIPELINE_END', agent_name: 'coordinator', stage: '', message: 'Pipeline completed' },
    ];

    it('should write 5 post-error events successfully', async () => {
      for (const evt of POST_ERROR_EVENTS) {
        const { status, data } = await post<Event>('/api/events', {
          event_type: evt.event_type,
          agent_name: evt.agent_name,
          stage: evt.stage,
          message: evt.message,
          metadata: {},
        });

        expect(status).toBe(201);
        expect(data.pipeline_id).toBe(pipelineId);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 5: 按 event_type=ERROR 过滤 — 错误隔离验证
  // ════════════════════════════════════════════════════════
  describe('Step 5: Filter by event_type=ERROR (error isolation)', () => {
    it('should return exactly 1 ERROR event when filtering by event_type=ERROR', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&event_type=ERROR&sort=asc`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.total).toBe(1);

      const errorEvent = data.data[0];
      expect(errorEvent.id).toBe(errorEventId);
      expect(errorEvent.event_type).toBe('ERROR');
      expect(errorEvent.agent_name).toBe(ERROR_AGENT_NAME);
    });

    it('should show the ERROR is within correct stage context', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&stage=${ERROR_STAGE}&event_type=ERROR`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].stage).toBe(ERROR_STAGE);
      expect(data.data[0].id).toBe(errorEventId);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 6: 按 agent_name 过滤 — 确认错误 Agent 的事件包含 ERROR
  // ════════════════════════════════════════════════════════
  describe('Step 6: Filter by agent_name (agent context)', () => {
    it('should return all events for the error-producing agent, including the ERROR', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&agent_name=${ERROR_AGENT_NAME}&sort=asc`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBeGreaterThanOrEqual(1);

      // 该 Agent 的事件中必须包含 ERROR 事件
      const errorEvents = data.data.filter((e) => e.event_type === 'ERROR');
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].id).toBe(errorEventId);

      // 所有事件的 agent_name 必须匹配
      for (const event of data.data) {
        expect(event.agent_name).toBe(ERROR_AGENT_NAME);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 7: 关键词搜索 — "CONTRACT" 应搜索到错误事件
  // ════════════════════════════════════════════════════════
  describe('Step 7: Keyword search for "CONTRACT"', () => {
    it('should find the ERROR event when searching for "CONTRACT"', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&search=CONTRACT&sort=asc`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBeGreaterThanOrEqual(1);

      // 搜索结果必须包含错误事件
      const foundError = data.data.find((e) => e.id === errorEventId);
      expect(foundError).toBeDefined();
      expect(foundError!.event_type).toBe('ERROR');
    });

    it('should find the ERROR when searching for "CONTRACT_MISMATCH" (more specific)', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&search=CONTRACT_MISMATCH&sort=asc`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBeGreaterThanOrEqual(1);

      const foundError = data.data.find((e) => e.id === errorEventId);
      expect(foundError).toBeDefined();
    });

    it('should return empty for a search term that does not exist', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&search=ZZZ_NONEXISTENT_ZZZ&sort=asc`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 8: 综合过滤 — Stage + Agent + EventType 组合
  // ════════════════════════════════════════════════════════
  describe('Step 8: Combined filters — precise traceback', () => {
    it('should pinpoint error with stage + agent + event_type combo', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&stage=${ERROR_STAGE}&agent_name=${ERROR_AGENT_NAME}&event_type=ERROR`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].id).toBe(errorEventId);

      const meta = data.data[0].metadata as Record<string, unknown>;
      expect(meta.error_type).toBe('CONTRACT_MISMATCH');
      expect(meta.stack).toBeTruthy();
      expect(meta.code_context).toContain('event-validator.ts');
    });

    it('should allow the debugger to see events BEFORE the error (forward trace)', async () => {
      // 获取错误事件之前的所有事件（按 seq 排序，找到 error 的 seq）
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&sort=asc&pageSize=100`,
      );

      expect(status).toBe(200);

      const errorEvent = data.data.find((e) => e.id === errorEventId);
      expect(errorEvent).toBeDefined();

      // 获取 error 之前的所有事件（用于回溯）
      const eventsBeforeError = data.data.filter((e) => e.seq < errorEvent!.seq);
      expect(eventsBeforeError.length).toBeGreaterThanOrEqual(10); // 至少有前面的 10 条
    });
  });
});

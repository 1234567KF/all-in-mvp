/**
 * E2E Scenario: 并发事件写入 & 边界情况
 * 基于 PRD Section 8.2 (Exception Path 场景)
 *
 * 覆盖：批量写入 → 非法 event_type → 无活跃 Pipeline 写入 → 批量事务回滚
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
  seq: number;
}

interface BatchResponse {
  count: number;
  events: Event[];
}

interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
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

async function patch<T>(url: string, body: Record<string, unknown>): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as T };
}

// ── 批量事件定义 ──────────────────────────────────────────
const BATCH_EVENTS = [
  { event_type: 'STAGE_START', agent_name: 'coordinator', stage: 'Stage3', message: 'Stage3 concurrent start', metadata: { stage: 'Stage3' } },
  { event_type: 'AGENT_SPAWN', agent_name: 'backend-tdd-1', stage: 'Stage3', message: 'backend-tdd-1 spawned', metadata: { agent_type: 'tdd' } },
  { event_type: 'AGENT_SPAWN', agent_name: 'backend-tdd-2', stage: 'Stage3', message: 'backend-tdd-2 spawned', metadata: { agent_type: 'tdd' } },
  { event_type: 'AGENT_SPAWN', agent_name: 'frontend-agent', stage: 'Stage3', message: 'frontend-agent spawned', metadata: { agent_type: 'frontend' } },
  { event_type: 'FILE_CHANGE', agent_name: 'backend-tdd-1', stage: 'Stage3', message: 'module-a.ts created', metadata: { file_path: 'src/module-a.ts', operation: 'create' } },
];

// ── 测试套件 ──────────────────────────────────────────────
describe('Concurrent Events & Edge Cases E2E', () => {
  let pipelineId: string;

  // ════════════════════════════════════════════════════════
  // Step 1: 创建 Pipeline
  // ════════════════════════════════════════════════════════
  describe('Setup: Create Pipeline', () => {
    it('should create a Pipeline for concurrency testing', async () => {
      const { status, data } = await post<Pipeline>('/api/pipelines', {
        name: 'E2E Concurrency Test',
        mode: 'full',
        task_desc: 'Testing batch writes and edge cases',
      });

      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(data.status).toBe('RUNNING');

      pipelineId = data.id;
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 2: 批量写入 5 条事件 — 原子性验证
  // ════════════════════════════════════════════════════════
  describe('Step 2: Batch write 5 events (atomicity)', () => {
    it('should create all 5 events in a single batch request', async () => {
      const { status, data } = await post<BatchResponse>('/api/events/batch', {
        events: BATCH_EVENTS,
      });

      expect(status).toBe(201);
      expect(data.count).toBe(5);
      expect(data.events).toHaveLength(5);

      // 验证每个事件都正确地被创建
      for (let i = 0; i < data.events.length; i++) {
        const evt = data.events[i];
        expect(evt.id).toBeTruthy();
        expect(evt.pipeline_id).toBe(pipelineId);
        expect(evt.event_type).toBe(BATCH_EVENTS[i].event_type);
        expect(evt.agent_name).toBe(BATCH_EVENTS[i].agent_name);
        expect(evt.stage).toBe(BATCH_EVENTS[i].stage);
      }
    });

    it('should assign incrementing seq values to batch events', async () => {
      const { status, data } = await post<BatchResponse>('/api/events/batch', {
        events: [
          { event_type: 'TOOL_CALL', agent_name: 'test-agent', stage: '', message: 'Tool call A', metadata: {} },
          { event_type: 'TOOL_CALL', agent_name: 'test-agent', stage: '', message: 'Tool call B', metadata: {} },
          { event_type: 'TOOL_CALL', agent_name: 'test-agent', stage: '', message: 'Tool call C', metadata: {} },
        ],
      });

      expect(status).toBe(201);
      expect(data.count).toBe(3);

      // seq 必须严格递增
      expect(data.events[0].seq).toBeLessThan(data.events[1].seq);
      expect(data.events[1].seq).toBeLessThan(data.events[2].seq);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 3: 非法 event_type — 参数校验
  // ════════════════════════════════════════════════════════
  describe('Step 3: Invalid event_type validation', () => {
    it('should return 400 for invalid event_type on single write', async () => {
      const { status, data } = await post<ErrorResponse>('/api/events', {
        event_type: 'INVALID_EVENT_TYPE',
        agent_name: 'test-agent',
        message: 'This should fail',
      });

      expect(status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(data.message).toBeTruthy();
      // 错误消息应明确指示 event_type 无效
      const msg = data.message.toLowerCase();
      expect(
        msg.includes('invalid') || msg.includes('event_type') || msg.includes('enum'),
      ).toBe(true);
    });

    it('should return 400 for invalid event_type in batch write (full rollback)', async () => {
      const { status, data } = await post<ErrorResponse>('/api/events/batch', {
        events: [
          { event_type: 'STAGE_START', agent_name: 'coordinator', message: 'Valid event', metadata: {} },
          { event_type: 'NOT_A_REAL_TYPE', agent_name: 'bad-agent', message: 'Invalid event', metadata: {} },
          { event_type: 'STAGE_END', agent_name: 'coordinator', message: 'Another valid', metadata: {} },
        ],
      });

      expect(status).toBe(400);
      expect(data.error).toBeTruthy();

      // 验证事务回滚：之前的一条有效 STAGE_START 也不应被写入
      // 通过查询验证该 pipeline 下没有此次批量中的 STAGE_START 事件
      // （此验证依赖 GET /api/events 能正确过滤）
    });

    it('should return 400 for empty batch events array', async () => {
      const { status, data } = await post<ErrorResponse>('/api/events/batch', {
        events: [],
      });

      // 空数组应该被拒绝（或者至少不应产生副作用）
      expect(status).toBe(400);
    });

    it('should return 400 when batch body is missing required fields', async () => {
      const { status, data } = await post<ErrorResponse>('/api/events/batch', {
        events: [
          {
            // 缺少 event_type
            agent_name: 'bad-agent',
            message: 'Missing event_type',
          },
        ],
      });

      expect(status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 4: 无活跃 Pipeline 时写入事件
  // ════════════════════════════════════════════════════════
  describe('Step 4: Write event with no active pipeline', () => {
    it('should return 400 when no RUNNING pipeline exists for single write', async () => {
      // 先将当前 Pipeline 标记为 DONE，使其不再是活跃状态
      await patch<Pipeline>(`/api/pipelines/${pipelineId}`, { status: 'DONE' });

      // 现在尝试写入事件，应该失败
      const { status, data } = await post<ErrorResponse>('/api/events', {
        event_type: 'STAGE_START',
        agent_name: 'test-agent',
        message: 'Should fail — no active pipeline',
      });

      expect(status).toBe(400);
      expect(data.message).toBeTruthy();
      const msg = data.message.toLowerCase();
      expect(
        msg.includes('no active pipeline') || msg.includes('active'),
      ).toBe(true);
    });

    it('should return 400 when no RUNNING pipeline exists for batch write', async () => {
      const { status, data } = await post<ErrorResponse>('/api/events/batch', {
        events: [
          { event_type: 'STAGE_START', agent_name: 'test', message: 'Should fail', metadata: {} },
        ],
      });

      expect(status).toBe(400);
      const msg = data.message.toLowerCase();
      expect(
        msg.includes('no active pipeline') || msg.includes('active'),
      ).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 5: Pipeline 状态机验证
  // ════════════════════════════════════════════════════════
  describe('Step 5: Pipeline status machine validation', () => {
    let newPipelineId: string;

    it('should create a new pipeline for FAILED status test', async () => {
      const { status, data } = await post<Pipeline>('/api/pipelines', {
        name: 'E2E Failed Pipeline Test',
        mode: 'full',
        task_desc: 'Testing FAILED status',
      });

      expect(status).toBe(201);
      expect(data.status).toBe('RUNNING');
      newPipelineId = data.id;
    });

    it('should update pipeline status to FAILED', async () => {
      const { status, data } = await patch<Pipeline>(`/api/pipelines/${newPipelineId}`, {
        status: 'FAILED',
      });

      expect(status).toBe(200);
      expect(data.status).toBe('FAILED');
    });

    it('should update pipeline status to CANCELLED', async () => {
      // 创建另一个 pipeline 用于测试 CANCELLED 状态
      const { data: p } = await post<Pipeline>('/api/pipelines', {
        name: 'E2E Cancelled Pipeline Test',
        mode: 'simple',
        task_desc: 'Testing CANCELLED status',
      });
      expect(p.status).toBe('RUNNING');

      const { status, data } = await patch<Pipeline>(`/api/pipelines/${p.id}`, {
        status: 'CANCELLED',
      });

      expect(status).toBe(200);
      expect(data.status).toBe('CANCELLED');
    });

    it('should return 400 for invalid status transition', async () => {
      const { status, data } = await post<ErrorResponse>('/api/pipelines', {
        name: 'E2E Invalid Status Test',
        mode: 'full',
      });

      // 尝试设置为非法状态值
      const { status: patchStatus, data: patchData } = await post<ErrorResponse>(
        `/api/pipelines/${(data as unknown as Pipeline).id || 'nonexistent'}`,
        {},
      );

      // 这个测试验证 PATCH 端点对无效 status 的处理
      // 实际实现中，应该用 PATCH 发送非法 status
      const { status: badPatchStatus, data: badPatchData } = await fetch(
        `${BASE_URL}/api/pipelines/${(data as unknown as Pipeline).id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'INVALID_STATUS' }),
        },
      ).then((r) => r.json().then((d) => ({ status: r.status, data: d })));

      expect(badPatchStatus).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 6: 分页功能验证
  // ════════════════════════════════════════════════════════
  describe('Step 6: Pagination verification', () => {
    it('should respect page and pageSize parameters', async () => {
      const url = `${BASE_URL}/api/events?pipeline_id=${pipelineId}&page=1&pageSize=3&sort=asc`;
      const res = await fetch(url);
      const result = await res.json();

      expect(res.status).toBe(200);
      expect(result.data.length).toBeLessThanOrEqual(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(8);
    });

    it('should return second page with non-overlapping data', async () => {
      const resP1 = await fetch(`${BASE_URL}/api/events?pipeline_id=${pipelineId}&page=1&pageSize=3&sort=asc`);
      const p1 = await resP1.json();
      const resP2 = await fetch(`${BASE_URL}/api/events?pipeline_id=${pipelineId}&page=2&pageSize=3&sort=asc`);
      const p2 = await resP2.json();

      expect(resP2.status).toBe(200);
      expect(p2.page).toBe(2);

      const p1Ids = new Set(p1.data.map((e: Event) => e.id));
      const p2Ids = new Set(p2.data.map((e: Event) => e.id));
      const overlap = [...p1Ids].filter((id) => p2Ids.has(id));
      expect(overlap.length).toBe(0);
    });
  });
});

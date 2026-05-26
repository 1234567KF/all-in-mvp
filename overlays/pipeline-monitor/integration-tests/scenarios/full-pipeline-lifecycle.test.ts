/**
 * E2E Scenario: 完整流水线生命周期
 * 基于 PRD Section 4.1 (流水线执行监控) + Section 8.1 HP1
 *
 * 覆盖：Pipeline 创建 → 各 Stage 事件写入 → Pipeline 结束 → 时间线查询 → 统计验证
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:3000';

// ── 类型定义 ──────────────────────────────────────────────
interface Pipeline {
  id: string;
  name: string;
  status: string;
  mode: string;
  task_desc: string;
  created_at: string;
  updated_at: string;
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

interface StatsOverview {
  total_events: number;
  stage_distribution: Record<string, number>;
  agent_distribution: Record<string, number>;
  event_type_distribution: Record<string, number>;
}

interface StageDuration {
  stage: string;
  duration_ms: number;
  event_count: number;
}

// ── 测试上下文 ────────────────────────────────────────────
const STAGES = ['Stage1', 'Stage2', 'Stage3', 'Stage4'];
const AGENTS = [
  { name: 'pm-agent', stage: 'Stage1' },
  { name: 'arch-expert', stage: 'Stage2' },
  { name: 'domain-expert', stage: 'Stage2' },
  { name: 'grill-agent', stage: 'Stage2' },
  { name: 'coordinator', stage: 'Stage3' },
  { name: 'backend-tdd-1', stage: 'Stage3' },
  { name: 'backend-tdd-2', stage: 'Stage3' },
  { name: 'frontend-agent', stage: 'Stage3' },
  { name: 'test-expert', stage: 'Stage4' },
];

const FILES = [
  { path: 'docs/PRD.md', agent: 'pm-agent', stage: 'Stage1' },
  { path: 'docs/architecture.md', agent: 'arch-expert', stage: 'Stage2' },
  { path: 'docs/domain-model.md', agent: 'domain-expert', stage: 'Stage2' },
  { path: 'src/modules/pipeline/index.ts', agent: 'backend-tdd-1', stage: 'Stage3' },
  { path: 'src/modules/event/index.ts', agent: 'backend-tdd-2', stage: 'Stage3' },
  { path: 'frontend/src/App.vue', agent: 'frontend-agent', stage: 'Stage3' },
  { path: 'integration-tests/scenarios/e2e.test.ts', agent: 'test-expert', stage: 'Stage4' },
];

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

async function get<T>(url: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${url}`);
  return { status: res.status, data: await res.json() as T };
}

// ── 测试套件 ──────────────────────────────────────────────
describe('Full Pipeline Lifecycle E2E', () => {
  let pipelineId: string;
  const writtenEventIds: string[] = [];

  // ════════════════════════════════════════════════════════
  // Step 0: 创建 Pipeline
  // ════════════════════════════════════════════════════════
  describe('Step 0: Create Pipeline', () => {
    it('should create a Pipeline with status RUNNING', async () => {
      const { status, data } = await post<Pipeline>('/api/pipelines', {
        name: 'E2E Full Lifecycle Test Pipeline',
        mode: 'full',
        task_desc: 'E2E testing of the complete pipeline monitor lifecycle',
      });

      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(data.name).toBe('E2E Full Lifecycle Test Pipeline');
      expect(data.status).toBe('RUNNING');
      expect(data.mode).toBe('full');

      pipelineId = data.id;
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 1: 写入 PIPELINE_START 事件
  // ════════════════════════════════════════════════════════
  describe('Step 1: PIPELINE_START event', () => {
    it('should write PIPELINE_START event', async () => {
      const { status, data } = await post<Event>('/api/events', {
        event_type: 'PIPELINE_START',
        agent_name: 'system',
        message: 'Pipeline execution started',
        metadata: { mode: 'full', task_description: 'E2E testing' },
      });

      expect(status).toBe(201);
      expect(data.pipeline_id).toBe(pipelineId);
      expect(data.event_type).toBe('PIPELINE_START');
      expect(data.seq).toBeGreaterThanOrEqual(1);

      writtenEventIds.push(data.id);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 2: 写入所有 STAGE_START 事件 (Stage1 → Stage4)
  // ════════════════════════════════════════════════════════
  describe('Step 2: STAGE_START events (Stage1 → Stage4)', () => {
    it('should write STAGE_START for all 4 stages', async () => {
      for (const stage of STAGES) {
        const { status, data } = await post<Event>('/api/events', {
          event_type: 'STAGE_START',
          agent_name: 'pipeline-coordinator',
          stage,
          message: `${stage} started`,
          metadata: { stage, expected_duration: 30 },
        });

        expect(status).toBe(201);
        expect(data.stage).toBe(stage);
        expect(data.event_type).toBe('STAGE_START');
        expect(data.pipeline_id).toBe(pipelineId);

        writtenEventIds.push(data.id);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 3: 写入 AGENT_SPAWN 事件（每个 Agent 一条）
  // ════════════════════════════════════════════════════════
  describe('Step 3: AGENT_SPAWN events for all agents', () => {
    it('should write AGENT_SPAWN for each agent in correct stage', async () => {
      for (const agent of AGENTS) {
        const { status, data } = await post<Event>('/api/events', {
          event_type: 'AGENT_SPAWN',
          agent_name: agent.name,
          stage: agent.stage,
          message: `Agent ${agent.name} spawned in ${agent.stage}`,
          metadata: { agent_type: agent.name.split('-')[0] || agent.name, module: agent.stage },
        });

        expect(status).toBe(201);
        expect(data.agent_name).toBe(agent.name);
        expect(data.stage).toBe(agent.stage);
        expect(data.event_type).toBe('AGENT_SPAWN');

        writtenEventIds.push(data.id);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 4: 写入 FILE_CHANGE 事件（每个文件产出一条）
  // ════════════════════════════════════════════════════════
  describe('Step 4: FILE_CHANGE events for all file outputs', () => {
    it('should write FILE_CHANGE for each file created', async () => {
      for (const file of FILES) {
        const { status, data } = await post<Event>('/api/events', {
          event_type: 'FILE_CHANGE',
          agent_name: file.agent,
          stage: file.stage,
          message: `File created: ${file.path}`,
          metadata: {
            file_path: file.path,
            operation: 'create',
            agent_name: file.agent,
          },
        });

        expect(status).toBe(201);
        expect(data.event_type).toBe('FILE_CHANGE');
        expect(data.agent_name).toBe(file.agent);
        expect(data.stage).toBe(file.stage);

        writtenEventIds.push(data.id);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 5: 写入 STAGE_END 事件（带耗时）
  // ════════════════════════════════════════════════════════
  describe('Step 5: STAGE_END events with durations', () => {
    it('should write STAGE_END for all 4 stages with actual durations', async () => {
      const stageDurations: Record<string, number> = {
        Stage1: 25400,
        Stage2: 48300,
        Stage3: 125000,
        Stage4: 30200,
      };

      for (const stage of STAGES) {
        const { status, data } = await post<Event>('/api/events', {
          event_type: 'STAGE_END',
          agent_name: 'pipeline-coordinator',
          stage,
          message: `${stage} completed`,
          metadata: {
            stage,
            actual_duration_ms: stageDurations[stage],
            gate_result: stage !== 'Stage4' ? 'pass' : 'pass',
          },
        });

        expect(status).toBe(201);
        expect(data.event_type).toBe('STAGE_END');
        expect(data.stage).toBe(stage);

        const meta = data.metadata as Record<string, unknown>;
        expect(meta.actual_duration_ms).toBe(stageDurations[stage]);

        writtenEventIds.push(data.id);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 6: 写入 PIPELINE_END + 更新 Pipeline 状态为 DONE
  // ════════════════════════════════════════════════════════
  describe('Step 6: Complete pipeline (PIPELINE_END + status DONE)', () => {
    it('should write PIPELINE_END event', async () => {
      const { status, data } = await post<Event>('/api/events', {
        event_type: 'PIPELINE_END',
        agent_name: 'pipeline-coordinator',
        message: 'Pipeline execution completed successfully',
        metadata: { status: 'DONE', duration_ms: 228900 },
      });

      expect(status).toBe(201);
      expect(data.event_type).toBe('PIPELINE_END');
      expect(data.pipeline_id).toBe(pipelineId);

      writtenEventIds.push(data.id);
    });

    it('should update pipeline status to DONE', async () => {
      const { status, data } = await patch<Pipeline>(`/api/pipelines/${pipelineId}`, {
        status: 'DONE',
      });

      expect(status).toBe(200);
      expect(data.status).toBe('DONE');
      expect(data.id).toBe(pipelineId);
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 7: 查询完整事件时间线 — 验证顺序和完整性
  // ════════════════════════════════════════════════════════
  describe('Step 7: Query complete event timeline', () => {
    it('should return all events in correct seq order', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&sort=asc&pageSize=100`,
      );

      expect(status).toBe(200);
      expect(data.data.length).toBeGreaterThanOrEqual(writtenEventIds.length);
      expect(data.total).toBeGreaterThanOrEqual(writtenEventIds.length);

      // 验证 seq 递增
      const events = data.data;
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
      }

      // 验证所有写入的事件都在返回列表中
      const returnedIds = new Set(events.map((e) => e.id));
      for (const id of writtenEventIds) {
        expect(returnedIds.has(id)).toBe(true);
      }
    });

    it('should have events in expected chronological order: PIPELINE_START → STAGE1 → STAGE2 → STAGE3 → STAGE4 → PIPELINE_END', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&sort=asc&pageSize=100`,
      );

      expect(status).toBe(200);

      const events = data.data;

      // 提取关键事件顺序
      const keyEvents = events.filter((e) =>
        ['PIPELINE_START', 'PIPELINE_END', 'STAGE_START'].includes(e.event_type),
      );

      const eventSequence = keyEvents.map((e) => ({
        type: e.event_type,
        stage: e.stage,
        seq: e.seq,
      }));

      // PIPELINE_START 必须是第一个
      expect(eventSequence[0].type).toBe('PIPELINE_START');

      // STAGE_START 顺序必须是 Stage1 → Stage2 → Stage3 → Stage4
      const stageStarts = eventSequence.filter((e) => e.type === 'STAGE_START');
      expect(stageStarts.map((s) => s.stage)).toEqual(['Stage1', 'Stage2', 'Stage3', 'Stage4']);

      // PIPELINE_END 必须是最后一个关键事件
      const lastKeyEvent = eventSequence[eventSequence.length - 1];
      expect(lastKeyEvent.type).toBe('PIPELINE_END');
    });

    it('should allow filtering by stage', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&stage=Stage3&sort=asc`,
      );

      expect(status).toBe(200);
      for (const event of data.data) {
        expect(event.stage).toBe('Stage3');
      }
    });

    it('should allow filtering by event_type', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&event_type=FILE_CHANGE&sort=asc`,
      );

      expect(status).toBe(200);
      for (const event of data.data) {
        expect(event.event_type).toBe('FILE_CHANGE');
      }
    });

    it('should allow combined filtering (stage + event_type)', async () => {
      const { status, data } = await get<EventListResponse>(
        `/api/events?pipeline_id=${pipelineId}&stage=Stage3&event_type=AGENT_SPAWN&sort=asc`,
      );

      expect(status).toBe(200);
      for (const event of data.data) {
        expect(event.stage).toBe('Stage3');
        expect(event.event_type).toBe('AGENT_SPAWN');
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Step 8: 统计概览验证
  // ════════════════════════════════════════════════════════
  describe('Step 8: Stats overview validation', () => {
    it('should return correct stats overview with distributions', async () => {
      const { status, data } = await get<StatsOverview>(
        `/api/stats/overview?pipeline_id=${pipelineId}`,
      );

      expect(status).toBe(200);
      expect(data.total_events).toBeGreaterThanOrEqual(writtenEventIds.length);

      // 验证 stage_distribution — 每个 Stage 都应有事件
      const stageDist = data.stage_distribution;
      for (const stage of STAGES) {
        expect(stageDist[stage]).toBeGreaterThan(0);
      }

      // 验证 event_type_distribution — 核心事件类型都应出现
      const typeDist = data.event_type_distribution;
      expect(typeDist['PIPELINE_START']).toBeGreaterThanOrEqual(1);
      expect(typeDist['PIPELINE_END']).toBeGreaterThanOrEqual(1);
      expect(typeDist['STAGE_START']).toBeGreaterThanOrEqual(4);
      expect(typeDist['STAGE_END']).toBeGreaterThanOrEqual(4);
      expect(typeDist['AGENT_SPAWN']).toBeGreaterThanOrEqual(AGENTS.length);
      expect(typeDist['FILE_CHANGE']).toBeGreaterThanOrEqual(FILES.length);

      // 验证 agent_distribution — 已知 Agent 都应出现
      const agentDist = data.agent_distribution;
      for (const agent of AGENTS) {
        expect(agentDist[agent.name]).toBeGreaterThan(0);
      }
    });

    it('should return stage duration stats', async () => {
      const { status, data } = await get<StageDuration[]>(
        `/api/stats/stage-duration?pipeline_id=${pipelineId}`,
      );

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      const stageSet = new Set(data.map((s) => s.stage));
      for (const stage of STAGES) {
        expect(stageSet.has(stage)).toBe(true);
      }

      // 每个 Stage 有耗时数据
      for (const sd of data) {
        expect(sd.duration_ms).toBeGreaterThan(0);
        expect(sd.event_count).toBeGreaterThan(0);
      }
    });

    it('should return agent activity stats', async () => {
      const { status, data } = await get<
        Array<{
          agent_name: string;
          event_count: number;
          file_changes: number;
          errors: number;
          first_seen: string;
          last_seen: string;
        }>
      >(`/api/stats/agent-activity?pipeline_id=${pipelineId}`);

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      const agentNames = new Set(data.map((a) => a.agent_name));
      for (const agent of ['pm-agent', 'backend-tdd-1', 'frontend-agent']) {
        expect(agentNames.has(agent)).toBe(true);
      }

      for (const activity of data) {
        expect(activity.event_count).toBeGreaterThan(0);
        expect(activity.first_seen).toBeTruthy();
        expect(activity.last_seen).toBeTruthy();
      }
    });
  });
});

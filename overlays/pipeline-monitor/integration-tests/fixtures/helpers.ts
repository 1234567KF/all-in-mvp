/**
 * 测试辅助函数 — Pipeline Monitor MVP E2E Tests
 *
 * 封装 HTTP 请求方法，提供类型安全的 API 调用。
 * 所有 E2E 测试文件通过此模块与后端交互。
 */

const BASE_URL = 'http://localhost:3000';

// ════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════

export interface Pipeline {
  id: string;
  name: string;
  status: string;
  mode: string;
  task_desc: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
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

export interface EventListResponse {
  data: Event[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BatchResponse {
  count: number;
  events: Event[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface StatsOverview {
  total_events: number;
  stage_distribution: Record<string, number>;
  agent_distribution: Record<string, number>;
  event_type_distribution: Record<string, number>;
}

export interface StageDuration {
  stage: string;
  duration_ms: number;
  event_count: number;
}

export interface AgentActivity {
  agent_name: string;
  event_count: number;
  file_changes: number;
  errors: number;
  first_seen: string;
  last_seen: string;
}

// ════════════════════════════════════════════════════════
// HTTP 辅助函数
// ════════════════════════════════════════════════════════

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as T;
  return { status: res.status, data };
}

export async function apiPatch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as T;
  return { status: res.status, data };
}

export async function apiGet<T>(path: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = await res.json() as T;
  return { status: res.status, data };
}

/**
 * 创建 Pipeline 并断言 201
 */
export async function createPipeline(name: string, mode = 'full', taskDesc = 'E2E test'): Promise<Pipeline> {
  const { status, data } = await apiPost<Pipeline>('/api/pipelines', {
    name,
    mode,
    task_desc: taskDesc,
  });
  if (status !== 201) {
    throw new Error(`Failed to create pipeline: ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * 写入单条事件并断言 201
 */
export async function writeEvent(payload: Record<string, unknown>): Promise<Event> {
  const { status, data } = await apiPost<Event>('/api/events', payload);
  if (status !== 201) {
    throw new Error(`Failed to write event: ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * 批量写入事件并断言 201
 */
export async function writeEventsBatch(
  events: Record<string, unknown>[],
): Promise<BatchResponse> {
  const { status, data } = await apiPost<BatchResponse>('/api/events/batch', { events });
  if (status !== 201) {
    throw new Error(`Failed to batch write events: ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * 查询事件列表
 */
export async function queryEvents(params: Record<string, string | number>): Promise<{
  status: number;
  data: EventListResponse;
}> {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    query.set(key, String(val));
  }
  return apiGet<EventListResponse>(`/api/events?${query.toString()}`);
}

/**
 * 获取统计概览
 */
export async function getStatsOverview(pipelineId: string): Promise<StatsOverview> {
  const { status, data } = await apiGet<StatsOverview>(
    `/api/stats/overview?pipeline_id=${pipelineId}`,
  );
  if (status !== 200) {
    throw new Error(`Failed to get stats overview: ${status}`);
  }
  return data;
}

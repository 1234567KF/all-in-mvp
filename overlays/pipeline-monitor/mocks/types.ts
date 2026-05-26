/**
 * Shared TypeScript types matching the API contract.
 * All types mirror the schemas defined in api-contract.yaml.
 */

// ─── Pipeline ────────────────────────────────────────────────────────────────

export type PipelineStatus = "RUNNING" | "DONE" | "FAILED" | "CANCELLED";
export type PipelineMode = "full" | "incremental" | "simple";

export interface Pipeline {
  id: string;
  name: string;
  status: PipelineStatus;
  mode: PipelineMode;
  task_desc: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineCreate {
  name: string;
  mode?: PipelineMode;
  task_desc?: string;
}

export interface PipelineUpdate {
  status: "DONE" | "FAILED" | "CANCELLED";
}

// ─── Event ───────────────────────────────────────────────────────────────────

export type EventType =
  | "PIPELINE_START"
  | "PIPELINE_END"
  | "STAGE_START"
  | "STAGE_END"
  | "AGENT_SPAWN"
  | "AGENT_DONE"
  | "AGENT_BLOCKED"
  | "FILE_CHANGE"
  | "TOOL_CALL"
  | "ERROR"
  | "GATE_CHECK"
  | "GRILL_ROUND";

export interface Event {
  id: string;
  pipeline_id: string;
  event_type: EventType;
  agent_name: string;
  stage: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  seq: number;
}

export interface EventCreate {
  event_type: string;
  agent_name?: string;
  stage?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface EventBatchCreate {
  events: EventCreate[];
}

export interface EventList {
  data: Event[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

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

// ─── Error ───────────────────────────────────────────────────────────────────

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

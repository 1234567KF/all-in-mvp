// Event 数据模型类型
export interface Event {
  id: string;
  pipelineId: string;
  eventType: EventType;
  agentName: string;
  stage: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  seq: number;
}

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

export const VALID_EVENT_TYPES: EventType[] = [
  "PIPELINE_START", "PIPELINE_END",
  "STAGE_START", "STAGE_END",
  "AGENT_SPAWN", "AGENT_DONE", "AGENT_BLOCKED",
  "FILE_CHANGE", "TOOL_CALL",
  "ERROR", "GATE_CHECK", "GRILL_ROUND",
];

export interface EventCreate {
  eventType: EventType;
  pipelineId?: string;
  agentName?: string;
  stage?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface EventBatchCreate {
  events: EventCreate[];
}

export interface EventQuery {
  pipelineId: string;
  stage?: string;
  agentName?: string;
  eventType?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
}

export interface StatsOverview {
  totalEvents: number;
  stageDistribution: Record<string, number>;
  agentDistribution: Record<string, number>;
  eventTypeDistribution: Record<string, number>;
}

export interface StageDuration {
  stage: string;
  durationMs: number;
  eventCount: number;
}

export interface AgentActivity {
  agentName: string;
  eventCount: number;
  fileChanges: number;
  errors: number;
  firstSeen: string;
  lastSeen: string;
}

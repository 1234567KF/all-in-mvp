/**
 * Mock API Server — Pipeline Monitor MVP
 *
 * Hono-based mock server on port 3001, implementing all 9 API endpoints
 * as defined in docs/api-contract.yaml.
 *
 * Usage:
 *   npm install && npm start
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { v4 as uuidv4 } from "uuid";

import {
  mockPipeline,
  mockEvents,
  getFreshPipeline,
  getFreshEvents,
  ALL_STAGES,
  ALL_AGENTS,
  ALL_EVENT_TYPES,
} from "./data.js";

import type {
  Pipeline,
  PipelineCreate,
  PipelineUpdate,
  Event,
  EventCreate,
  EventBatchCreate,
  EventList,
  StatsOverview,
  StageDuration,
  AgentActivity,
  ErrorResponse,
} from "./types.js";

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = new Hono();
app.use("/*", cors());

// ─── In-memory state ─────────────────────────────────────────────────────────

let pipeline: Pipeline = getFreshPipeline();
let events: Event[] = getFreshEvents();
let nextSeq = events.length + 1;

// ─── Error helpers ───────────────────────────────────────────────────────────

function err(status: 400 | 404, error: string, message: string, details?: Record<string, unknown>): Response {
  const body: ErrorResponse = { error, message, details };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ======================================================================
//  Pipeline endpoints
// ======================================================================

// POST /api/pipelines — Create pipeline
app.post("/api/pipelines", async (c) => {
  let body: PipelineCreate;
  try {
    body = await c.req.json();
  } catch {
    return err(400, "INVALID_JSON", "请求体不是有效的 JSON");
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return err(400, "VALIDATION_ERROR", "name 字段为必填项", {
      field: "name",
      constraint: "required, non-empty string",
    });
  }

  const now = new Date().toISOString();
  const newPipeline: Pipeline = {
    id: uuidv4(),
    name: body.name.trim(),
    status: "RUNNING",
    mode: body.mode ?? "full",
    task_desc: body.task_desc ?? "",
    created_at: now,
    updated_at: now,
  };

  pipeline = newPipeline;
  events = []; // reset events for new pipeline
  nextSeq = 1;

  return new Response(JSON.stringify(newPipeline), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});

// PATCH /api/pipelines/:id — Update pipeline status
app.patch("/api/pipelines/:id", async (c) => {
  const id = c.req.param("id");

  if (id !== pipeline.id) {
    return err(404, "NOT_FOUND", `Pipeline ${id} 不存在`);
  }

  let body: PipelineUpdate;
  try {
    body = await c.req.json();
  } catch {
    return err(400, "INVALID_JSON", "请求体不是有效的 JSON");
  }

  const validStatuses = ["DONE", "FAILED", "CANCELLED"] as const;
  if (!body.status || !validStatuses.includes(body.status)) {
    return err(400, "VALIDATION_ERROR", `status 必须是 ${validStatuses.join(" | ")} 之一`, {
      field: "status",
      received: body.status,
    });
  }

  pipeline.status = body.status;
  pipeline.updated_at = new Date().toISOString();

  return new Response(JSON.stringify(pipeline), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// GET /api/pipelines/current — Get latest pipeline
app.get("/api/pipelines/current", (c) => {
  return new Response(JSON.stringify(pipeline), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ======================================================================
//  Event endpoints
// ======================================================================

// POST /api/events — Create single event
app.post("/api/events", async (c) => {
  let body: EventCreate;
  try {
    body = await c.req.json();
  } catch {
    return err(400, "INVALID_JSON", "请求体不是有效的 JSON");
  }

  if (!body.event_type || typeof body.event_type !== "string") {
    return err(400, "VALIDATION_ERROR", "event_type 字段为必填项", {
      field: "event_type",
    });
  }

  if (!body.message || typeof body.message !== "string") {
    return err(400, "VALIDATION_ERROR", "message 字段为必填项", {
      field: "message",
    });
  }

  const newEvent: Event = {
    id: uuidv4(),
    pipeline_id: pipeline.id,
    event_type: body.event_type as Event["event_type"],
    agent_name: body.agent_name ?? "",
    stage: body.stage ?? "",
    message: body.message,
    metadata: body.metadata ?? {},
    timestamp: new Date().toISOString(),
    seq: nextSeq++,
  };

  events.push(newEvent);

  return new Response(JSON.stringify(newEvent), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});

// POST /api/events/batch — Batch create events
app.post("/api/events/batch", async (c) => {
  let body: EventBatchCreate;
  try {
    body = await c.req.json();
  } catch {
    return err(400, "INVALID_JSON", "请求体不是有效的 JSON");
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return err(400, "VALIDATION_ERROR", "events 数组为必填项，且不能为空", {
      field: "events",
    });
  }

  // Validate all events before inserting (simulated transaction)
  for (let i = 0; i < body.events.length; i++) {
    const ev = body.events[i];
    if (!ev.event_type || !ev.message) {
      return err(400, "VALIDATION_ERROR", `events[${i}]: event_type 和 message 为必填项`, {
        index: i,
        item: ev,
      });
    }
  }

  const now = new Date().toISOString();
  const created: Event[] = body.events.map((ev) => ({
    id: uuidv4(),
    pipeline_id: pipeline.id,
    event_type: ev.event_type as Event["event_type"],
    agent_name: ev.agent_name ?? "",
    stage: ev.stage ?? "",
    message: ev.message,
    metadata: ev.metadata ?? {},
    timestamp: now,
    seq: nextSeq++,
  }));

  events.push(...created);

  return new Response(
    JSON.stringify({ count: created.length, events: created }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );
});

// GET /api/events — Query events with filters + pagination
app.get("/api/events", (c) => {
  const pipelineId = c.req.query("pipeline_id");
  const stage = c.req.query("stage");
  const agentName = c.req.query("agent_name");
  const eventType = c.req.query("event_type");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") ?? "50", 10);
  const sort = c.req.query("sort") === "desc" ? "desc" : "asc";

  // pipeline_id is required per contract
  if (!pipelineId) {
    return err(400, "VALIDATION_ERROR", "pipeline_id 查询参数为必填项", {
      field: "pipeline_id",
    });
  }

  let filtered = events.filter((e) => {
    if (e.pipeline_id !== pipelineId) return false;
    if (stage && e.stage !== stage) return false;
    if (agentName && e.agent_name !== agentName) return false;
    if (eventType && e.event_type !== eventType) return false;
    if (from && e.timestamp < from) return false;
    if (to && e.timestamp > to) return false;
    if (search) {
      const lower = search.toLowerCase();
      const inMessage = e.message.toLowerCase().includes(lower);
      const inMeta = JSON.stringify(e.metadata).toLowerCase().includes(lower);
      if (!inMessage && !inMeta) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) =>
    sort === "desc" ? b.seq - a.seq : a.seq - b.seq,
  );

  // Paginate
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const result: EventList = {
    data: paged,
    total,
    page,
    pageSize,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ======================================================================
//  Stats endpoints
// ======================================================================

// GET /api/stats/overview — Pipeline overview statistics
app.get("/api/stats/overview", (c) => {
  const pipelineId = c.req.query("pipeline_id") ?? pipeline.id;

  const relevantEvents = events.filter((e) => e.pipeline_id === pipelineId);

  // Stage distribution
  const stageDist: Record<string, number> = {};
  for (const s of ALL_STAGES) stageDist[s] = 0;
  for (const e of relevantEvents) {
    if (e.stage) stageDist[e.stage] = (stageDist[e.stage] || 0) + 1;
  }

  // Agent distribution
  const agentDist: Record<string, number> = {};
  for (const a of ALL_AGENTS) agentDist[a] = 0;
  for (const e of relevantEvents) {
    if (e.agent_name) agentDist[e.agent_name] = (agentDist[e.agent_name] || 0) + 1;
  }

  // Event type distribution
  const typeDist: Record<string, number> = {};
  for (const t of ALL_EVENT_TYPES) typeDist[t] = 0;
  for (const e of relevantEvents) {
    typeDist[e.event_type] = (typeDist[e.event_type] || 0) + 1;
  }

  const result: StatsOverview = {
    total_events: relevantEvents.length,
    stage_distribution: stageDist,
    agent_distribution: agentDist,
    event_type_distribution: typeDist,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// GET /api/stats/stage-duration — Stage duration statistics
app.get("/api/stats/stage-duration", (c) => {
  const pipelineId = c.req.query("pipeline_id") ?? pipeline.id;

  const relevantEvents = events.filter((e) => e.pipeline_id === pipelineId);

  // For each stage, find STAGE_START and STAGE_END timestamps
  const stageMap = new Map<string, { start?: string; end?: string; count: number }>();

  for (const e of relevantEvents) {
    if (!e.stage) continue;

    if (!stageMap.has(e.stage)) {
      stageMap.set(e.stage, { count: 0 });
    }
    const entry = stageMap.get(e.stage)!;
    entry.count++;

    if (e.event_type === "STAGE_START") {
      entry.start = e.timestamp;
    } else if (e.event_type === "STAGE_END") {
      entry.end = e.timestamp;
    }
  }

  const result: StageDuration[] = [];
  for (const [stage, entry] of stageMap) {
    let durationMs = 0;
    if (entry.start && entry.end) {
      durationMs = new Date(entry.end).getTime() - new Date(entry.start).getTime();
    }
    result.push({
      stage,
      duration_ms: durationMs,
      event_count: entry.count,
    });
  }

  // Sort by stage name
  result.sort((a, b) => a.stage.localeCompare(b.stage));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// GET /api/stats/agent-activity — Agent activity statistics
app.get("/api/stats/agent-activity", (c) => {
  const pipelineId = c.req.query("pipeline_id") ?? pipeline.id;

  const relevantEvents = events.filter((e) => e.pipeline_id === pipelineId);

  const agentMap = new Map<
    string,
    {
      event_count: number;
      file_changes: number;
      errors: number;
      first_seen?: string;
      last_seen?: string;
    }
  >();

  for (const e of relevantEvents) {
    if (!e.agent_name) continue;

    if (!agentMap.has(e.agent_name)) {
      agentMap.set(e.agent_name, { event_count: 0, file_changes: 0, errors: 0 });
    }
    const entry = agentMap.get(e.agent_name)!;
    entry.event_count++;

    if (e.event_type === "FILE_CHANGE") entry.file_changes++;
    if (e.event_type === "ERROR") entry.errors++;

    if (!entry.first_seen || e.timestamp < entry.first_seen) {
      entry.first_seen = e.timestamp;
    }
    if (!entry.last_seen || e.timestamp > entry.last_seen) {
      entry.last_seen = e.timestamp;
    }
  }

  const result: AgentActivity[] = [];
  for (const [agentName, entry] of agentMap) {
    result.push({
      agent_name: agentName,
      event_count: entry.event_count,
      file_changes: entry.file_changes,
      errors: entry.errors,
      first_seen: entry.first_seen ?? "",
      last_seen: entry.last_seen ?? "",
    });
  }

  // Sort by event count descending
  result.sort((a, b) => b.event_count - a.event_count);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ======================================================================
//  Catch-all — unknown routes
// ======================================================================

app.all("*", (c) => {
  return err(400, "UNKNOWN_ROUTE", `路由 ${c.req.method} ${c.req.path} 不存在`);
});

// ======================================================================
//  Start server
// ======================================================================

const PORT = 3001;

console.log(`\n🚀 Pipeline Monitor Mock Server starting on http://localhost:${PORT}`);
console.log(`📋 9 endpoints ready:`);
console.log(`   POST   /api/pipelines          — Create pipeline`);
console.log(`   PATCH  /api/pipelines/:id      — Update pipeline status`);
console.log(`   GET    /api/pipelines/current  — Get latest pipeline`);
console.log(`   POST   /api/events             — Create event`);
console.log(`   POST   /api/events/batch       — Batch create events`);
console.log(`   GET    /api/events             — Query events`);
console.log(`   GET    /api/stats/overview      — Overview stats`);
console.log(`   GET    /api/stats/stage-duration — Stage duration stats`);
console.log(`   GET    /api/stats/agent-activity — Agent activity stats`);
console.log(`\n📦 Mock data: ${mockEvents.length} events, 1 pipeline\n`);

serve({ fetch: app.fetch, port: PORT });

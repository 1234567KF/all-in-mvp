import { Hono } from "hono";
import type { EventCreate, EventBatchCreate } from "./types.js";
import { VALID_EVENT_TYPES } from "./types.js";
import * as service from "./service.js";

export const eventRoutes = new Hono();

// POST /api/events — 写入单条事件
eventRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.eventType || !body.message) {
    return c.json({ error: "VALIDATION_ERROR", message: "Fields 'eventType' and 'message' are required" }, 400);
  }
  if (!VALID_EVENT_TYPES.includes(body.eventType)) {
    return c.json({ error: "VALIDATION_ERROR", message: `Invalid event_type: ${body.eventType}` }, 400);
  }
  const input: EventCreate = {
    eventType: body.eventType,
    pipelineId: body.pipelineId,
    agentName: body.agentName || "",
    stage: body.stage || "",
    message: body.message,
    metadata: body.metadata || {},
  };
  const result = await service.createEvent(input);
  if ("error" in result) {
    return c.json({ error: "BUSINESS_ERROR", message: result.error }, result.status);
  }
  return c.json(result.event, 201);
});

// POST /api/events/batch — 批量写入事件
eventRoutes.post("/batch", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.events)) {
    return c.json({ error: "VALIDATION_ERROR", message: "Field 'events' must be an array" }, 400);
  }
  const input: EventBatchCreate = { events: body.events };
  const result = await service.createEventBatch(input);
  if ("error" in result) {
    return c.json({ error: "BUSINESS_ERROR", message: result.error }, result.status);
  }
  return c.json(result, 201);
});

// GET /api/events — 查询事件列表
eventRoutes.get("/", async (c) => {
  const pipelineId = c.req.query("pipeline_id");
  if (!pipelineId) {
    return c.json({ error: "VALIDATION_ERROR", message: "Query parameter 'pipeline_id' is required" }, 400);
  }
  const result = await service.queryEvents({
    pipelineId,
    stage: c.req.query("stage"),
    agentName: c.req.query("agent_name"),
    eventType: c.req.query("event_type"),
    from: c.req.query("from"),
    to: c.req.query("to"),
    search: c.req.query("search"),
    page: parseInt(c.req.query("page") || "1"),
    pageSize: parseInt(c.req.query("pageSize") || "50"),
    sort: (c.req.query("sort") as "asc" | "desc") || "asc",
  });
  return c.json(result, 200);
});

// ============================================================
// 统计路由
// ============================================================
export const statsRoutes = new Hono();

// GET /api/stats/overview
statsRoutes.get("/overview", async (c) => {
  const pipelineId = c.req.query("pipeline_id");
  const result = await service.getOverview(pipelineId || undefined);
  if (!result) {
    return c.json({ error: "NOT_FOUND", message: "No pipeline data found" }, 404);
  }
  return c.json(result, 200);
});

// GET /api/stats/stage-duration
statsRoutes.get("/stage-duration", async (c) => {
  const pipelineId = c.req.query("pipeline_id");
  const result = await service.getStageDuration(pipelineId || undefined);
  return c.json(result, 200);
});

// GET /api/stats/agent-activity
statsRoutes.get("/agent-activity", async (c) => {
  const pipelineId = c.req.query("pipeline_id");
  const result = await service.getAgentActivity(pipelineId || undefined);
  return c.json(result, 200);
});

// GET /api/stats/agent-tasks
statsRoutes.get("/agent-tasks", async (c) => {
  const pipelineId = c.req.query("pipeline_id");
  const result = await service.getAgentTaskProgress(pipelineId || undefined);
  return c.json(result, 200);
});

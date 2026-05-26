import { Hono } from "hono";
import type { PipelineCreate, PipelineUpdate } from "./types.js";
import * as service from "./service.js";

const VALID_STATUSES = ["DONE", "FAILED", "CANCELLED"] as const;

export const pipelineRoutes = new Hono();

// POST /api/pipelines — 创建 Pipeline
pipelineRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.name || typeof body.name !== "string") {
    return c.json({ error: "VALIDATION_ERROR", message: "Field 'name' is required" }, 400);
  }
  const input: PipelineCreate = {
    name: body.name,
    mode: body.mode,
    taskDesc: body.taskDesc,
    sessionName: body.sessionName,
  };
  const pipeline = await service.createPipeline(input);
  return c.json(pipeline, 201);
});

// PATCH /api/pipelines/:id — 更新 Pipeline 状态
pipelineRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body || !body.status || !VALID_STATUSES.includes(body.status)) {
    return c.json({ error: "VALIDATION_ERROR", message: "Field 'status' must be one of: DONE, FAILED, CANCELLED" }, 400);
  }
  const input: PipelineUpdate = { status: body.status };
  const pipeline = await service.updatePipeline(id, input);
  if (!pipeline) {
    return c.json({ error: "NOT_FOUND", message: `Pipeline '${id}' not found` }, 404);
  }
  return c.json(pipeline, 200);
});

// GET /api/pipelines — 获取所有 Pipeline 列表
pipelineRoutes.get("/", async (c) => {
  const list = await service.listPipelines();
  return c.json(list, 200);
});

// POST /api/pipelines/stop-all — 停止所有运行中的流水线（必须在 /:id 之前注册）
pipelineRoutes.post("/stop-all", async (c) => {
  const result = await service.stopAllPipelines();
  return c.json(result, 200);
});

// GET /api/pipelines/current — 获取当前 Pipeline（必须在 /:id 之前注册）
pipelineRoutes.get("/current", async (c) => {
  const pipeline = await service.getCurrentPipeline();
  if (!pipeline) {
    return c.json({ error: "NOT_FOUND", message: "No pipeline found" }, 404);
  }
  return c.json(pipeline, 200);
});

// GET /api/pipelines/:id — 获取指定 Pipeline
pipelineRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const pipeline = await service.getPipelineById(id);
  if (!pipeline) {
    return c.json({ error: "NOT_FOUND", message: `Pipeline '${id}' not found` }, 404);
  }
  return c.json(pipeline, 200);
});

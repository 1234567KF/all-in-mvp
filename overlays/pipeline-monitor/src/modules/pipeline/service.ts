import { db } from "../../db/index.js";
import { pipelines } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type { Pipeline, PipelineCreate, PipelineUpdate } from "./types.js";

function uuid(): string {
  return crypto.randomUUID();
}
function now(): string {
  return new Date().toISOString();
}

export async function createPipeline(input: PipelineCreate): Promise<Pipeline> {
  const pipeline: Pipeline = {
    id: uuid(),
    name: input.name,
    status: "RUNNING",
    mode: input.mode || "full",
    taskDesc: input.taskDesc || "",
    sessionName: input.sessionName || "",
    createdAt: now(),
    updatedAt: now(),
  };

  await db.insert(pipelines).values({
    id: pipeline.id,
    name: pipeline.name,
    status: pipeline.status,
    mode: pipeline.mode,
    taskDesc: pipeline.taskDesc,
    sessionName: pipeline.sessionName,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
  });

  return pipeline;
}

export async function updatePipeline(id: string, input: PipelineUpdate): Promise<Pipeline | null> {
  const existing = await db.select().from(pipelines).where(eq(pipelines.id, id)).get();
  if (!existing) return null;

  await db.update(pipelines).set({
    status: input.status,
    updatedAt: now(),
  }).where(eq(pipelines.id, id));

  const updated = await db.select().from(pipelines).where(eq(pipelines.id, id)).get();
  if (!updated) return null;

  return {
    id: updated.id,
    name: updated.name,
    status: updated.status as Pipeline["status"],
    mode: updated.mode as Pipeline["mode"],
    taskDesc: updated.taskDesc,
    sessionName: updated.sessionName,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function getCurrentPipeline(): Promise<Pipeline | null> {
  const result = await db.select().from(pipelines).orderBy(desc(pipelines.createdAt)).limit(1).get();
  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    status: result.status as Pipeline["status"],
    mode: result.mode as Pipeline["mode"],
    taskDesc: result.taskDesc,
    sessionName: result.sessionName,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const result = await db.select().from(pipelines).where(eq(pipelines.id, id)).get();
  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    status: result.status as Pipeline["status"],
    mode: result.mode as Pipeline["mode"],
    taskDesc: result.taskDesc,
    sessionName: result.sessionName,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

// Pipeline 列表项（含事件计数）
export interface PipelineListItem extends Pipeline {
  eventCount: number;
}

export async function listPipelines(): Promise<PipelineListItem[]> {
  const { events } = await import("../../db/schema.js");
  const { count, sql } = await import("drizzle-orm");

  const rows = db.all(sql`
    SELECT p.*, COALESCE(e.cnt, 0) as event_count
    FROM pipelines p
    LEFT JOIN (
      SELECT pipeline_id, COUNT(*) as cnt FROM events GROUP BY pipeline_id
    ) e ON p.id = e.pipeline_id
    ORDER BY p.created_at DESC
  `);

  return (rows as any[]).map((r: any) => ({
    id: r.id,
    name: r.name,
    status: r.status as Pipeline["status"],
    mode: r.mode as Pipeline["mode"],
    taskDesc: r.taskDesc,
    sessionName: r.session_name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    eventCount: r.event_count,
  }));
}

// 停止所有运行中的流水线
export async function stopAllPipelines(): Promise<{ count: number }> {
  const eventsTable = (await import("../../db/schema.js")).events;
  const { count, sql } = await import("drizzle-orm");

  // 查找所有 RUNNING 状态的 pipeline
  const runningPipelines = await db.select().from(pipelines)
    .where(eq(pipelines.status, "RUNNING"))
    .orderBy(desc(pipelines.createdAt));

  if (runningPipelines.length === 0) {
    return { count: 0 };
  }

  const now = new Date().toISOString();

  for (const p of runningPipelines) {
    // 更新状态为 CANCELLED
    await db.update(pipelines).set({
      status: "CANCELLED",
      updatedAt: now,
    }).where(eq(pipelines.id, p.id));

    // 计算下一个 seq
    const maxSeq = await db.select({ maxSeq: sql<number>`COALESCE(MAX(seq), 0)` })
      .from(eventsTable)
      .where(eq(eventsTable.pipelineId, p.id)).get();
    const nextSeq = (maxSeq?.maxSeq ?? 0) + 1;

    // 记录 PIPELINE_END 事件
    await db.insert(eventsTable).values({
      id: crypto.randomUUID(),
      pipelineId: p.id,
      eventType: "PIPELINE_END",
      agentName: "system",
      stage: "",
      message: `批量停止: 由用户手动终止`,
      metadata: JSON.stringify({ status: "CANCELLED", triggeredBy: "user" }),
      timestamp: now,
      seq: nextSeq,
    });
  }

  return { count: runningPipelines.length };
}

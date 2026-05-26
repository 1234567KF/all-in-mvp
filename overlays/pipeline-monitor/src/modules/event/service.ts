import { db } from "../../db/index.js";
import { events, pipelines } from "../../db/schema.js";
import { eq, and, like, gte, lte, desc, asc, count, sql } from "drizzle-orm";
import type {
  Event, EventCreate, EventBatchCreate, EventQuery,
  StatsOverview, StageDuration, AgentActivity,
} from "./types.js";
import { VALID_EVENT_TYPES } from "./types.js";

const MAX_EVENTS_PER_PIPELINE = 10000;

function uuid(): string {
  return crypto.randomUUID();
}
function now(): string {
  return new Date().toISOString();
}

// ============================================================
// 写入
// ============================================================

export async function createEvent(input: EventCreate): Promise<{ event: Event } | { error: string; status: number }> {
  // 确定 pipelineId: 优先使用传入的，否则找当前活跃的
  let targetPipelineId = input.pipelineId;
  if (!targetPipelineId) {
    const currentPipeline = await db.select().from(pipelines)
      .where(eq(pipelines.status, "RUNNING"))
      .orderBy(desc(pipelines.createdAt))
      .limit(1).get();
    if (!currentPipeline) {
      return { error: "No active pipeline", status: 400 };
    }
    targetPipelineId = currentPipeline.id;
  }

  // 检查事件上限
  const eventCount = await db.select({ count: count() }).from(events)
    .where(eq(events.pipelineId, targetPipelineId!)).get();
  if (eventCount && eventCount.count >= MAX_EVENTS_PER_PIPELINE) {
    return { error: `Event limit exceeded (max: ${MAX_EVENTS_PER_PIPELINE})`, status: 400 };
  }

  // 验证 event_type
  if (!VALID_EVENT_TYPES.includes(input.eventType)) {
    return { error: `Invalid event_type: ${input.eventType}`, status: 400 };
  }

  // 计算下一个 seq
  const maxSeq = await db.select({ maxSeq: sql<number>`COALESCE(MAX(seq), 0)` }).from(events)
    .where(eq(events.pipelineId, targetPipelineId!)).get();
  const nextSeq = (maxSeq?.maxSeq ?? 0) + 1;

  const event: Event = {
    id: uuid(),
    pipelineId: targetPipelineId!,
    eventType: input.eventType,
    agentName: input.agentName || "",
    stage: input.stage || "",
    message: input.message,
    metadata: input.metadata || {},
    timestamp: now(),
    seq: nextSeq,
  };

  await db.insert(events).values({
    id: event.id,
    pipelineId: event.pipelineId,
    eventType: event.eventType,
    agentName: event.agentName,
    stage: event.stage,
    message: event.message,
    metadata: JSON.stringify(event.metadata),
    timestamp: event.timestamp,
    seq: event.seq,
  });

  return { event };
}

export async function createEventBatch(input: EventBatchCreate): Promise<{ events: Event[]; count: number } | { error: string; status: number }> {
  if (!input.events || input.events.length === 0) {
    return { error: "Events array cannot be empty", status: 400 };
  }

  // 从 batch 中第一个事件的 pipelineId 确定目标
  const firstPipelineId = input.events[0].pipelineId;
  let targetPipelineId = firstPipelineId;
  if (!targetPipelineId) {
    const currentPipeline = await db.select().from(pipelines)
      .where(eq(pipelines.status, "RUNNING"))
      .orderBy(desc(pipelines.createdAt))
      .limit(1).get();
    if (!currentPipeline) {
      return { error: "No active pipeline", status: 400 };
    }
    targetPipelineId = currentPipeline.id;
  }

  // 验证所有 event_type
  for (const ev of input.events) {
    if (!ev.eventType || !VALID_EVENT_TYPES.includes(ev.eventType)) {
      return { error: `Invalid event_type: ${ev.eventType}`, status: 400 };
    }
    if (!ev.message) {
      return { error: "Each event must have a message", status: 400 };
    }
  }

  // 检查上限
  const eventCount = await db.select({ count: count() }).from(events)
    .where(eq(events.pipelineId, targetPipelineId)).get();
  if (eventCount && eventCount.count + input.events.length > MAX_EVENTS_PER_PIPELINE) {
    return { error: `Event limit exceeded (max: ${MAX_EVENTS_PER_PIPELINE})`, status: 400 };
  }

  const maxSeq = await db.select({ maxSeq: sql<number>`COALESCE(MAX(seq), 0)` }).from(events)
    .where(eq(events.pipelineId, targetPipelineId)).get();
  let nextSeq = (maxSeq?.maxSeq ?? 0) + 1;

  const createdEvents: Event[] = [];

  // 使用事务批量插入
  await db.transaction(async (tx) => {
    for (const ev of input.events) {
      const event: Event = {
        id: uuid(),
        pipelineId: targetPipelineId,
        eventType: ev.eventType,
        agentName: ev.agentName || "",
        stage: ev.stage || "",
        message: ev.message,
        metadata: ev.metadata || {},
        timestamp: now(),
        seq: nextSeq++,
      };
      await tx.insert(events).values({
        id: event.id,
        pipelineId: event.pipelineId,
        eventType: event.eventType,
        agentName: event.agentName,
        stage: event.stage,
        message: event.message,
        metadata: JSON.stringify(event.metadata),
        timestamp: event.timestamp,
        seq: event.seq,
      });
      createdEvents.push(event);
    }
  });

  return { events: createdEvents, count: createdEvents.length };
}

// ============================================================
// 查询
// ============================================================

export async function queryEvents(query: EventQuery): Promise<{ data: Event[]; total: number; page: number; pageSize: number }> {
  const { pipelineId, stage, agentName, eventType, from, to, search, page = 1, pageSize = 50, sort = "asc" } = query;

  const conditions = [eq(events.pipelineId, pipelineId)];
  if (stage) conditions.push(eq(events.stage, stage));
  if (agentName) conditions.push(eq(events.agentName, agentName));
  if (eventType) conditions.push(eq(events.eventType, eventType));
  if (from) conditions.push(gte(events.timestamp, from));
  if (to) conditions.push(lte(events.timestamp, to));
  if (search) conditions.push(like(events.message, `%${search}%`));

  const whereClause = and(...conditions);

  // 总数
  const totalResult = await db.select({ count: count() }).from(events).where(whereClause).get();
  const total = totalResult?.count ?? 0;

  // 分页查询
  const offset = (page - 1) * pageSize;
  const rows = await db.select().from(events)
    .where(whereClause)
    .orderBy(sort === "desc" ? desc(events.seq) : asc(events.seq))
    .limit(pageSize)
    .offset(offset);

  const data: Event[] = rows.map((row) => ({
    id: row.id,
    pipelineId: row.pipelineId,
    eventType: row.eventType as Event["eventType"],
    agentName: row.agentName,
    stage: row.stage,
    message: row.message,
    metadata: JSON.parse(row.metadata),
    timestamp: row.timestamp,
    seq: row.seq,
  }));

  return { data, total, page, pageSize };
}

// ============================================================
// 统计
// ============================================================

export async function getOverview(pipelineId?: string): Promise<StatsOverview | null> {
  let pid = pipelineId;
  if (!pid) {
    const current = await db.select().from(pipelines)
      .where(eq(pipelines.status, "RUNNING"))
      .orderBy(desc(pipelines.createdAt)).limit(1).get();
    if (!current) return null;
    pid = current.id;
  }

  const allEvents = await db.select().from(events).where(eq(events.pipelineId, pid));
  const totalEvents = allEvents.length;

  const stageDistribution: Record<string, number> = {};
  const agentDistribution: Record<string, number> = {};
  const eventTypeDistribution: Record<string, number> = {};

  for (const ev of allEvents) {
    if (ev.stage) stageDistribution[ev.stage] = (stageDistribution[ev.stage] || 0) + 1;
    if (ev.agentName) agentDistribution[ev.agentName] = (agentDistribution[ev.agentName] || 0) + 1;
    eventTypeDistribution[ev.eventType] = (eventTypeDistribution[ev.eventType] || 0) + 1;
  }

  return { totalEvents, stageDistribution, agentDistribution, eventTypeDistribution };
}

export async function getStageDuration(pipelineId?: string): Promise<StageDuration[]> {
  let pid = pipelineId;
  if (!pid) {
    const current = await db.select().from(pipelines)
      .where(eq(pipelines.status, "RUNNING"))
      .orderBy(desc(pipelines.createdAt)).limit(1).get();
    if (!current) return [];
    pid = current.id;
  }

  // 找所有 STAGE_START 和 STAGE_END 配对
  const stageStarts = await db.select().from(events)
    .where(and(eq(events.pipelineId, pid), eq(events.eventType, "STAGE_START")))
    .orderBy(asc(events.seq));

  const stageEnds = await db.select().from(events)
    .where(and(eq(events.pipelineId, pid), eq(events.eventType, "STAGE_END")))
    .orderBy(asc(events.seq));

  const result: StageDuration[] = [];
  for (const start of stageStarts) {
    const end = stageEnds.find((e) => e.stage === start.stage);
    const durationMs = end ? new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime() : 0;
    const evCount = (await db.select({ count: count() }).from(events)
      .where(and(eq(events.pipelineId, pid), eq(events.stage, start.stage))).get())?.count ?? 0;

    result.push({ stage: start.stage, durationMs, eventCount: evCount });
  }

  return result;
}

export async function getAgentActivity(pipelineId?: string): Promise<AgentActivity[]> {
  let pid = pipelineId;
  if (!pid) {
    const current = await db.select().from(pipelines)
      .where(eq(pipelines.status, "RUNNING"))
      .orderBy(desc(pipelines.createdAt)).limit(1).get();
    if (!current) return [];
    pid = current.id;
  }

  const allEvents = await db.select().from(events).where(eq(events.pipelineId, pid));
  const agentMap = new Map<string, { eventCount: number; fileChanges: number; errors: number; firstSeen: string; lastSeen: string }>();

  for (const ev of allEvents) {
    if (!ev.agentName) continue;
    const entry = agentMap.get(ev.agentName) || { eventCount: 0, fileChanges: 0, errors: 0, firstSeen: ev.timestamp, lastSeen: ev.timestamp };
    entry.eventCount++;
    if (ev.eventType === "FILE_CHANGE") entry.fileChanges++;
    if (ev.eventType === "ERROR") entry.errors++;
    if (ev.timestamp < entry.firstSeen) entry.firstSeen = ev.timestamp;
    if (ev.timestamp > entry.lastSeen) entry.lastSeen = ev.timestamp;
    agentMap.set(ev.agentName, entry);
  }

  const result: AgentActivity[] = [];
  for (const [agentName, data] of agentMap) {
    result.push({ agentName, ...data });
  }
  result.sort((a, b) => b.eventCount - a.eventCount);

  return result;
}

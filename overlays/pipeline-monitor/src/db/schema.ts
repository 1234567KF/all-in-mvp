import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ============================================================
// 表 1: pipelines — 流水线实例
// ============================================================
export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Unnamed Pipeline"),
  status: text("status").notNull().default("RUNNING"),
  mode: text("mode").notNull().default("full"),
  taskDesc: text("task_desc").notNull().default(""),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

// ============================================================
// 表 2: events — 流水线事件日志
// ============================================================
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id").notNull().references(() => pipelines.id),
  eventType: text("event_type").notNull(),
  agentName: text("agent_name").notNull().default(""),
  stage: text("stage").notNull().default(""),
  message: text("message").notNull().default(""),
  metadata: text("metadata").notNull().default("{}"),
  timestamp: text("timestamp").notNull().default("(datetime('now'))"),
  seq: integer("seq").notNull(),
});

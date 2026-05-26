import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const sqlite = new Database("pipeline-monitor.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Run migrations
export function initDB() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pipelines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Unnamed Pipeline',
      status TEXT NOT NULL DEFAULT 'RUNNING',
      mode TEXT NOT NULL DEFAULT 'full',
      task_desc TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL REFERENCES pipelines(id),
      event_type TEXT NOT NULL,
      agent_name TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      seq INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
    CREATE INDEX IF NOT EXISTS idx_events_pipeline_seq ON events(pipeline_id, seq);
    CREATE INDEX IF NOT EXISTS idx_events_stage ON events(pipeline_id, stage);
    CREATE INDEX IF NOT EXISTS idx_events_agent ON events(pipeline_id, agent_name);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(pipeline_id, event_type);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(pipeline_id, timestamp);
  `);
}

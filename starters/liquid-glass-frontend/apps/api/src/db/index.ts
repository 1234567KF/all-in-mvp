import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"

import * as schema from "./schema.js"

export * from "./schema.js"

// ─── 向后兼容（立即初始化）──────────────────────────────────────────
const sqlite = new Database("sqlite.db")
export const db = drizzle(sqlite, { schema })

// ─── 工厂函数（供懒初始化和测试使用）─────────────────────────────────
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema, Database>>

export function createDrizzleDb(sqlite: Database): DrizzleDB {
  return drizzle(sqlite, { schema })
}

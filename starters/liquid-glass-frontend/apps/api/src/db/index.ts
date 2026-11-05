import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"

import * as schema from "./schema.js"

export * from "./schema.js"

// ─── 工厂函数（连接由 db.ts 惰性创建，测试用内存库注入）────────────────
// 注意：本文件不做模块级 new Database()，否则会在 cwd 旁生成空库文件，
// 且与 data/sqlite.db 的真实连接路径不一致。
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema, Database>>

export function createDrizzleDb(sqlite: Database): DrizzleDB {
  return drizzle(sqlite, { schema })
}

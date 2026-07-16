import { Database } from "bun:sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { existsSync, mkdirSync } from "fs"
import path from "path"

import { createDrizzleDb, type DrizzleDB, users } from "./db/index.js"

// ─── 环境变量约定 ───────────────────────────────────────────────────
// DATA_DIR         SQLite 数据库文件所在目录。默认 `${cwd}/data`。
//                  Docker 部署时通过 compose 卷映射 `./data:/app/data`。
// MIGRATIONS_DIR   Drizzle 迁移目录。默认 `${cwd}/drizzle`。
//                  `bun build --compile` 出的独立二进制里 `import.meta.dir`
//                  行为不稳定，必须用相对 CWD 的路径而非源码相对路径。
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data")
const dbPath = path.join(dataDir, "sqlite.db")
const migrationsFolder =
  process.env.MIGRATIONS_DIR || path.join(process.cwd(), "drizzle")

let sqlite: Database
let drizzleDb: DrizzleDB
let testDb: DrizzleDB | null = null

/**
 * @internal 注入内存 DB（仅用于测试）
 */
export function _setTestDb(d: DrizzleDB | null) {
  testDb = d
  if (d) drizzleDb = d
}

/** 惰性单例 — 首次调用时创建 DB + 执行迁移 + 种子数据 */
export function getDrizzle(): DrizzleDB {
  if (testDb) return testDb
  if (!drizzleDb) {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    sqlite = new Database(dbPath)
    sqlite.exec("PRAGMA journal_mode = WAL")
    drizzleDb = createDrizzleDb(sqlite)
    migrate(drizzleDb, { migrationsFolder })
    console.log(`✅ SQLite migrations applied (${dbPath}).`)

    // 种子数据：默认 admin 用户
    const existing = drizzleDb.select().from(users).all()
    if (existing.length === 0) {
      drizzleDb
        .insert(users)
        .values({ email: "admin", name: "Admin", role: "admin" })
        .run()
      console.log("🌱 Seeded admin user into database.")
    }
  }
  return drizzleDb
}

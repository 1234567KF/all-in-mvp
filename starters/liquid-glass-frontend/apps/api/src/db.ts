import { Database } from "bun:sqlite"
import { existsSync, mkdirSync } from "fs"
import path from "path"

import { bootstrapDatabase } from "./db/bootstrap.js"
import { seedDemoNotifications } from "./db/demo-seed.js"
import { createDrizzleDb, type DrizzleDB, users } from "./db/index.js"
import { env } from "./env.js"

// ─── 环境变量约定 ───────────────────────────────────────────────────
// DATA_DIR          SQLite 数据库文件所在目录。默认 `${cwd}/data`。
//                   Docker 部署时通过 compose 卷映射 `./data:/app/data`。
// DB_BOOTSTRAP_DIR  数据库结构来源目录（init.sql 或 drizzle/）。
//                   默认先找 `${cwd}/db-bootstrap`（Docker 镜像内），再回落到 cwd
//                   （本地开发 = apps/api）。模板用 init.sql，生成项目用 drizzle/。
/** SQLite 数据库文件所在目录（DATA_DIR，默认 `${cwd}/data`） */
export const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data")
/** SQLite 数据库文件路径 */
export const dbPath = path.join(dataDir, "sqlite.db")

let drizzleDb: DrizzleDB | null = null
let rawSqlite: Database | null = null
let testDb: DrizzleDB | null = null

/**
 * @internal 注入内存 DB（仅用于测试）。
 * 注入 / 清空时同步丢弃真实 sqlite 连接引用与 drizzle 缓存：
 * 否则先初始化过真实库的进程在注入测试库后，getRawSqlite() 会回落到真实文件库。
 */
export function _setTestDb(d: DrizzleDB | null) {
  testDb = d
  drizzleDb = d
  rawSqlite = null
}

/**
 * 获取底层 bun:sqlite 连接（供运维工具箱做 VACUUM / 统计，见 shared/sqlite-ops.ts）。
 * 惰性初始化：首次调用与 getDrizzle() 共用同一个连接。
 * 测试注入的是 Drizzle 壳而没有底层连接，需要运维函数时请显式传 db 参数。
 */
export function getRawSqlite(): Database {
  if (testDb) {
    throw new Error(
      "SQLite 底层连接不可用：测试注入的数据库不暴露 bun:sqlite 句柄，请显式传入 db 参数"
    )
  }
  getDrizzle()
  if (!rawSqlite) {
    throw new Error(
      "SQLite 底层连接不可用：数据库尚未初始化，请先调用 getDrizzle()"
    )
  }
  return rawSqlite
}

/** 惰性单例 — 首次调用时创建 DB + 自举结构 + 种子数据 */
export function getDrizzle(): DrizzleDB {
  if (testDb) return testDb
  if (drizzleDb) return drizzleDb

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  const sqlite = new Database(dbPath)
  try {
    sqlite.exec("PRAGMA journal_mode = WAL")
    const db = createDrizzleDb(sqlite)

    // 结构自举：模板执行 init.sql，生成项目应用 drizzle 迁移（bootstrap.ts 自动识别）
    const source = bootstrapDatabase(sqlite, db)
    console.log(
      source.kind === "init"
        ? `✅ SQLite schema initialized from init.sql (${source.path}).`
        : `✅ SQLite migrations applied from drizzle/ (${source.path}).`
    )

    // 种子数据：默认 admin 用户。失败与结构自举一样按启动失败处理，
    // 避免出现“库已建好但账号缺失”的静默坏状态。
    const existing = db.select().from(users).all()
    if (existing.length === 0) {
      db.insert(users)
        .values({ email: "admin", name: "Admin", role: "admin" })
        .run()
      console.log("🌱 Seeded admin user into database.")
    }

    // DEMO_MODE：幂等补齐演示通知（仅模板自部署/测试环境；真实业务项目不开启）
    if (env.DEMO_MODE) {
      const inserted = seedDemoNotifications(db)
      if (inserted > 0) {
        console.log(
          `🌱 DEMO_MODE: seeded ${inserted} demo notifications (admin inbox).`
        )
      }
    }

    drizzleDb = db
    rawSqlite = sqlite
    console.log(`✅ SQLite ready (${dbPath}).`)
    return db
  } catch (err) {
    // 初始化失败时释放连接，且不缓存半初始化的 DB 句柄：下一次调用会重新尝试，
    // 而不是返回一个结构不完整的库。
    try {
      sqlite.close()
    } catch {
      /* 连接可能已失效，忽略关闭异常 */
    }

    const detail = err instanceof Error ? err.message : String(err)
    console.error(
      [
        `❌ SQLite 初始化失败（${dbPath}）。`,
        `   原因：${detail.split("\n").join("\n   ")}`,
        "   模板仓库（结构来源 init.sql）：删除数据目录后重启，或执行 `bun run db:reset` 重建（会清空本地数据）；",
        "   scaffold 生成项目（结构来源 drizzle/）：检查 apps/api/drizzle 迁移是否完整、是否与存量库匹配；",
        "   迁移与存量库不匹配时，请先备份数据，再删除数据目录后重启重建。",
        "   若错误提示“多份结构来源并存”，请只保留 init.sql 或 drizzle/ 其中之一。",
      ].join("\n")
    )
    throw err
  }
}

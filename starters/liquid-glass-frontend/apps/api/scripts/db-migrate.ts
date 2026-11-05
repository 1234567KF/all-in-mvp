#!/usr/bin/env bun
/**
 * `bun run db:migrate` — 生成项目：把 apps/api/drizzle 迁移应用到本地 SQLite
 *
 * - 模板仓库（存在 apps/api/init.sql）：无迁移链，拒绝执行，提示改用 db:reset；
 * - scaffold 生成项目（init.sql 已被删除）：用 bun:sqlite + drizzle-orm
 *   bun-sqlite/migrator 直接应用迁移。
 *
 * 为什么不再 spawn `drizzle-kit migrate`：drizzle-kit 应用迁移时需要
 * better-sqlite3 / @libsql 驱动，而本项目连接走 bun:sqlite，生成项目并未安装
 * 这两者，干净环境下 `bunx drizzle-kit migrate` 会直接报驱动缺失而失败。
 *
 * DATA_DIR 约定与 src/db.ts 一致（默认 apps/api/data），应用后重启服务即可。
 */
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

import * as schema from "../src/db/schema.js"

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const initSqlPath = join(apiDir, "init.sql")
const migrationsFolder = join(apiDir, "drizzle")

// 模板守卫：模板没有迁移链，结构由 init.sql 重建
if (existsSync(initSqlPath)) {
  console.error(
    [
      "❌ 本仓库是模板：无迁移链，数据库由 init.sql 重建，不能执行 db:migrate。",
      "   本地重建请运行：bun run db:reset",
      "   （scaffold 生成的项目已删除 init.sql，可正常使用 db:migrate）",
    ].join("\n")
  )
  process.exit(1)
}

if (!existsSync(join(migrationsFolder, "meta", "_journal.json"))) {
  console.error(
    [
      `❌ 未找到 drizzle 迁移：${migrationsFolder}/meta/_journal.json`,
      "   生成项目首次应先运行 `bun run db:generate` 生成 baseline 迁移。",
    ].join("\n")
  )
  process.exit(1)
}

const dataDir = process.env.DATA_DIR || join(apiDir, "data")
const dbPath = join(dataDir, "sqlite.db")

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const sqlite = new Database(dbPath)
sqlite.exec("PRAGMA journal_mode = WAL")
const db = drizzle(sqlite, { schema })

try {
  migrate(db, { migrationsFolder })
  console.log(`✅ 迁移已应用：${migrationsFolder} → ${dbPath}`)
} catch (err) {
  console.error(
    `❌ 应用迁移失败（${dbPath}）：${err instanceof Error ? err.message : String(err)}`
  )
  console.error(
    "   本地库结构已过期/不匹配时，可备份后删除 data 目录，再重新执行 db:migrate。"
  )
  process.exitCode = 1
} finally {
  sqlite.close()
}

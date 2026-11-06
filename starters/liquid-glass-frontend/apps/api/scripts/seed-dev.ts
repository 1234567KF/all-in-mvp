/**
 * 本地开发种子数据脚本（手动执行，不随服务启动运行）
 *
 * 用法：bun apps/api/scripts/seed-dev.ts
 *      （package.json 的 db:seed-dev script 条目由后续波次补充）
 * 说明：补充 demo 用户等开发测试数据（幂等，已存在则跳过）。
 *       生产环境请勿执行。
 *
 * 机制约定（沉淀自实战项目）：
 *   ▸ 幂等播种：唯一键冲突 onConflictDoNothing，存量库可反复执行补齐新增数据
 *   ▸ 生产守卫：NODE_ENV=production 直接拒绝执行
 *   ▸ 账号定义唯一真源：src/db/seed-users.ts（R010）——本脚本只调用 seedUsers()，
 *     不再另写一份账号清单；`includeDevOnly: true` 才带上 demo / viewer 两个
 *     仅本地使用的演示账号
 *   ▸ 种子口令：`process.env.SEED_ADMIN_PASSWORD || DEV_SEED_PASSWORD`（生产环境
 *     由 src/env.ts 的启动守卫强制显式设置，缺失即拒绝启动），仓库内不落任何真实密码
 *
 * 路径约定：DATA_DIR 环境变量优先，默认 apps/api/data；结构来源由
 * bootstrapDatabase 自动探测（init.sql 或 drizzle/），脚本从仓库根执行也正确。
 * 不 import src/db/index.js —— 其模块级 `new Database("sqlite.db")` 会在 cwd
 * 产生副产物文件；这里仅引用纯声明的 schema.ts。
 */
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"

import { bootstrapDatabase } from "../src/db/bootstrap.js"
import { seedDemoNotifications } from "../src/db/demo-seed.js"
import * as schema from "../src/db/schema.js"
import { DEV_SEED_PASSWORD, seedUsers } from "../src/db/seed-users.js"

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

/** SQLite 数据文件所在目录（与 src/db.ts 的 DATA_DIR 约定一致） */
export function resolveDataDir(): string {
  return process.env.DATA_DIR || join(apiRoot, "data")
}

export type DevDb = ReturnType<typeof drizzle<typeof schema, Database>>

/** 打开本地 dev 库并应用全量迁移（不存在则创建） */
export function openDevDb(): DevDb {
  const dataDir = resolveDataDir()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const sqlite = new Database(join(dataDir, "sqlite.db"))
  sqlite.exec("PRAGMA journal_mode = WAL")
  const db = drizzle(sqlite, { schema })
  bootstrapDatabase(sqlite, db, { baseDir: apiRoot })
  return db
}

/**
 * 开发环境种子数据：全部演示账号（含 devOnly）+ 演示消息。
 * 账号清单与口令策略见 src/db/seed-users.ts（唯一定义，幂等）。
 */
export function seedDevData(d: DevDb): void {
  const inserted = seedUsers(d, { includeDevOnly: true })
  console.log(
    inserted > 0
      ? `🌱 补齐 ${inserted} 个演示账号（口令见 SEED_ADMIN_PASSWORD / dev 默认值）`
      : "🌱 演示账号已齐全，跳过"
  )

  seedDemoNotifications(d)
}

// 演示消息：数据与写入逻辑统一在 src/db/demo-seed.ts
// （DEMO_MODE 启动种子与本地 db:reset 复用同一份，避免两处漂移）
// 本地 db:reset 仍会由 seedDevData 一并补齐 7 条演示通知。

if (import.meta.main) {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ 禁止在生产环境执行 seed-dev")
    process.exit(1)
  }

  seedDevData(openDevDb())

  const usingEnv = !!process.env.SEED_ADMIN_PASSWORD
  console.log("\n🎉 本地开发种子数据就绪")
  console.log("  管理员  admin")
  console.log("  用户    demo@example.com / viewer@example.com")
  console.log(
    usingEnv
      ? "  口令    取自 SEED_ADMIN_PASSWORD"
      : `  口令    本地默认 ${DEV_SEED_PASSWORD}（未设 SEED_ADMIN_PASSWORD）`
  )
  console.log(
    "  消息    admin 的 7 条演示通知（4 未读 / 3 已读，登录后看顶栏）"
  )
}

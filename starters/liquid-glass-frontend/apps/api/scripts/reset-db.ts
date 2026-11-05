/**
 * 本地开发数据库重置脚本（手动执行，不随服务启动运行）
 *
 * 用法：bun apps/api/scripts/reset-db.ts
 *      （package.json 的 db:reset script 条目由后续波次补充）
 * 场景：拉到迁移基线变更后，本地 dev 库结构过期时，删库重建 + 重新播种。
 * 说明：仅操作本地 gitignore 的 data/sqlite.db*，不影响任何提交内容。
 */
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"

import { openDevDb, resolveDataDir, seedDevData } from "./seed-dev.js"

if (process.env.NODE_ENV === "production") {
  console.error("❌ 禁止在生产环境执行 db 重置")
  process.exit(1)
}

const dataDir = resolveDataDir()

for (const f of ["sqlite.db", "sqlite.db-shm", "sqlite.db-wal"]) {
  const p = join(dataDir, f)
  if (existsSync(p)) {
    rmSync(p)
    console.log(`🗑️  已删除 ${f}`)
  }
}

console.log("♻️  正在重建数据库并播种...")
const db = openDevDb()

console.log("🌱 正在导入本地开发种子数据...")
seedDevData(db)

console.log("✅ 数据库重置完成")

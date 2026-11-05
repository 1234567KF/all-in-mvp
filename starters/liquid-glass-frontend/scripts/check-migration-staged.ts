#!/usr/bin/env bun
/**
 * Pre-commit 迁移守门：拦截手写 / 残缺的迁移提交
 *
 * 规则：新增（A）/修改（M）的 apps/api/drizzle/*.sql 必须满足
 *   1) 同编号 meta/NNNN_snapshot.json 也在暂存区
 *   2) _journal.json 也在暂存区（新增迁移必然更新 journal）
 *
 * 删除（D）/重命名（R）不拦截（支持 squash / 历史清理）。
 *
 * 模板仓库模式（存在 apps/api/init.sql）：规则相反——
 *   - 禁止提交 apps/api/drizzle/ 下的迁移 / snapshot / journal；
 *   - schema.ts 变更必须同时提交重新生成的 apps/api/init.sql。
 * scaffold 生成项目会删除 init.sql，因此回到上面的迁移配对规则。
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"

type StagedFile = { status: string; path: string }

function stagedFiles(): StagedFile[] {
  const r = spawnSync("git", ["diff", "--cached", "--name-status"], {
    encoding: "utf-8",
  })
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t")
      // 重命名：R100\told\tnew，取新路径
      const status = parts[0][0]
      const path = parts[parts.length - 1]
      return { status, path }
    })
}

const all = stagedFiles()
const allPaths = new Set(all.map((f) => f.path))

// ── 模板仓库模式：单份 init.sql，无迁移链 ────────────────────────────────────
const TEMPLATE_INIT_SQL = "apps/api/init.sql"
if (existsSync(TEMPLATE_INIT_SQL)) {
  const problems: string[] = []

  // 双来源守卫：模板模式下 init.sql 与本地 drizzle/ 迁移目录不能并存。
  // 并存意味着结构事实源不唯一（scaffold 会删 init.sql，模板则不应生成 drizzle/）。
  if (existsSync("apps/api/drizzle/meta/_journal.json")) {
    problems.push(
      "检测到结构来源并存：apps/api/init.sql 与 apps/api/drizzle/ 迁移同时存在。只保留一份结构来源（模板留 init.sql，生成项目留 drizzle/）"
    )
  }

  const forbiddenDrizzleFiles = all.filter(
    (f) => f.path.startsWith("apps/api/drizzle/") && f.status !== "D"
  )
  if (forbiddenDrizzleFiles.length > 0) {
    problems.push(
      `模板仓库禁止提交迁移脚本：${forbiddenDrizzleFiles.map((f) => f.path).join(", ")}`
    )
  }

  const schemaChanged = allPaths.has("apps/api/src/db/schema.ts")
  const initSqlChanged = allPaths.has(TEMPLATE_INIT_SQL)
  if (schemaChanged && !initSqlChanged) {
    problems.push(
      "apps/api/src/db/schema.ts 有变更但 apps/api/init.sql 未一起提交（请运行 bun --filter api db:init:generate）"
    )
  }

  if (problems.length > 0) {
    console.error("\n❌ 模板仓库数据库文件提交被拦截：\n")
    problems.forEach((problem) => console.error(`  - ${problem}`))
    console.error(
      "\n💡 模板仓库规则：schema 变更 → bun --filter api db:init:generate → 提交 init.sql；禁止生成 drizzle/ 迁移。\n"
    )
    process.exit(1)
  }

  process.exit(0)
}

// 只关心新增 / 修改 / 重命名后的 SQL，忽略删除
const sqlChanges = all.filter(
  (f) =>
    /^apps\/api\/drizzle\/\d{4}_[^/]+\.sql$/.test(f.path) && f.status !== "D"
)

if (sqlChanges.length === 0) process.exit(0)

const problems: string[] = []

const hasNewMigration = sqlChanges.some((f) => f.status === "A")

if (hasNewMigration && !allPaths.has("apps/api/drizzle/meta/_journal.json")) {
  problems.push(
    "检测到迁移 SQL 新增但 apps/api/drizzle/meta/_journal.json 未一起提交"
  )
}

for (const sql of sqlChanges) {
  const match = sql.path.match(/(\d{4})_[^/]+\.sql$/)
  if (!match) continue
  const prefix = match[1]
  const snapshot = `apps/api/drizzle/meta/${prefix}_snapshot.json`
  if (!allPaths.has(snapshot)) {
    problems.push(
      `${sql.path} 缺少配对的 ${snapshot}（请用 cd apps/api && bunx drizzle-kit generate 生成，禁止手写迁移）`
    )
  }
}

if (problems.length > 0) {
  console.error("\n❌ 迁移文件提交被拦截：\n")
  problems.forEach((p) => console.error(`  - ${p}`))
  console.error(
    "\n💡 若确有 schema 变更，请：cd apps/api && bunx drizzle-kit generate --name <desc>"
  )
  console.error("   然后 git add 所有生成的文件后重新提交。\n")
  process.exit(1)
}

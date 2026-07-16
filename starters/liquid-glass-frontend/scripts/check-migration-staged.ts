#!/usr/bin/env bun
/**
 * Pre-commit 迁移守门：拦截手写 / 残缺的迁移提交
 *
 * 规则：新增（A）/修改（M）的 apps/api/drizzle/*.sql 必须满足
 *   1) 同编号 meta/NNNN_snapshot.json 也在暂存区
 *   2) _journal.json 也在暂存区（新增迁移必然更新 journal）
 *
 * 删除（D）/重命名（R）不拦截（支持 squash / 历史清理）。
 */
import { spawnSync } from "node:child_process"

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

// 只关心新增 / 修改 / 重命名后的 SQL，忽略删除
const sqlChanges = all.filter(
  (f) =>
    /^apps\/api\/drizzle\/\d{4}_[^/]+\.sql$/.test(f.path) && f.status !== "D"
)

if (sqlChanges.length === 0) process.exit(0)

const problems: string[] = []

if (!allPaths.has("apps/api/drizzle/meta/_journal.json")) {
  problems.push(
    "检测到迁移 SQL 新增/修改但 apps/api/drizzle/meta/_journal.json 未一起提交"
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

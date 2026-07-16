/**
 * 迁移预检脚本：在内存 SQLite 上执行全量迁移 + 检测 schema 漂移
 *
 * 用法：cd apps/api && bun run migrate:check
 * 退出码：0=通过 1=失败
 *
 * 检查项：
 *   0. Journal / .sql / snapshot 三方一致（无孤儿、无遗漏、无重复）
 *   1. 全量迁移 SQL 能在新库上顺利执行（无 duplicate column 等错误）
 *   2. 迁移结果与 schema.ts 定义一致（防止手写迁移导致漂移）
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

import * as schema from "../src/db/schema.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const apiDir = join(__dirname, "..")
const migrationsFolder = join(apiDir, "drizzle")

// ── Step 0: Journal ↔ SQL 一致性检查 ──────────────────────────────────────────
try {
  const journalPath = join(migrationsFolder, "meta", "_journal.json")
  if (!existsSync(journalPath)) {
    console.error(`❌ 未找到 journal 文件: ${journalPath}`)
    process.exit(1)
  }
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: { idx: number; tag: string }[]
  }

  const sqlFiles = readdirSync(migrationsFolder)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))

  const metaDir = join(migrationsFolder, "meta")
  const snapshotFiles = readdirSync(metaDir)
    .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
    .map((f) => f.replace(/_snapshot\.json$/, ""))

  const problems: string[] = []

  // 1) journal tag 必须存在对应 .sql 文件
  const sqlSet = new Set(sqlFiles)
  for (const e of journal.entries) {
    if (!sqlSet.has(e.tag))
      problems.push(`journal 中记录了 ${e.tag}，但缺少对应的 .sql 文件`)
  }

  // 2) .sql 文件必须在 journal 中登记（否则不会被 drizzle-kit migrate 执行）
  const tagSet = new Set(journal.entries.map((e) => e.tag))
  for (const t of sqlFiles) {
    if (!tagSet.has(t))
      problems.push(
        `发现 .sql 文件 ${t}.sql 未在 _journal.json 登记（不会被执行）`
      )
  }

  // 3) 每个 .sql 必须配对同编号 snapshot（防止手写迁移导致 generate 失衡）
  const snapshotPrefixSet = new Set(snapshotFiles) // e.g. '0000'
  const sqlPrefixSet = new Set(sqlFiles.map((t) => t.slice(0, 4)))
  for (const t of sqlFiles) {
    const prefix = t.slice(0, 4)
    if (!snapshotPrefixSet.has(prefix))
      problems.push(
        `迁移 ${t}.sql 缺少对应的 meta/${prefix}_snapshot.json（手写迁移会导致 drizzle-kit generate 基线错乱）`
      )
  }
  for (const prefix of snapshotPrefixSet) {
    if (!sqlPrefixSet.has(prefix))
      problems.push(
        `发现孤儿快照 meta/${prefix}_snapshot.json，但无对应的 ${prefix}_*.sql 文件`
      )
  }

  // 4) idx / tag 不能重复，idx 必须从 0 起连续
  const idxSeen = new Set<number>()
  const tagSeen = new Set<string>()
  for (const e of journal.entries) {
    if (idxSeen.has(e.idx)) problems.push(`journal 中 idx ${e.idx} 重复`)
    if (tagSeen.has(e.tag)) problems.push(`journal 中 tag ${e.tag} 重复`)
    idxSeen.add(e.idx)
    tagSeen.add(e.tag)
  }
  const sortedIdx = [...idxSeen].sort((a, b) => a - b)
  sortedIdx.forEach((v, i) => {
    if (v !== i) problems.push(`journal idx 不连续：期望 ${i}，实际 ${v}`)
  })

  if (problems.length > 0) {
    console.error("❌ Journal 一致性检查失败：")
    problems.forEach((p) => console.error(`  - ${p}`))
    process.exit(1)
  }
  console.log(
    `✅ Journal / .sql / snapshot 三方一致（${journal.entries.length} 条迁移，${snapshotFiles.length} 份快照）`
  )
} catch (err) {
  console.error("❌ Journal 一致性检查异常:", (err as Error).message)
  process.exit(1)
}

// ── Step 1: 全量迁移预检 ──────────────────────────────────────────────────────
try {
  const db = new Database(":memory:")
  const drizzleDb = drizzle(db, { schema })
  migrate(drizzleDb, { migrationsFolder })
  db.close()
  console.log("✅ 全量迁移测试执行成功")
} catch (err) {
  console.error("❌ 迁移预检 FAILED:", (err as Error).message)
  process.exit(1)
}

// ── Step 2: Schema 漂移检测 ────────────────────────────────────────────────────
// 拷贝 drizzle/ 到临时目录，跑 drizzle-kit generate；若产出新迁移文件 → drift
// （drizzle-kit generate 只读 schema.ts + 最新 snapshot，不连库，无需 SQLite 驱动）
const tmpDirRel = "./.tmp-check"
const tmpMigrationsRel = "./.tmp-check/drizzle"
const tmpConfigRel = "./.tmp-check/drizzle.check.config.ts"
const tmpDir = join(apiDir, tmpDirRel)
const tmpMigrationsDir = join(apiDir, tmpMigrationsRel)
const tmpConfigPath = join(apiDir, tmpConfigRel)

try {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  mkdirSync(tmpDir, { recursive: true })
  cpSync(migrationsFolder, tmpMigrationsDir, { recursive: true })

  const beforeSqls = new Set(
    readdirSync(tmpMigrationsDir).filter((f) => f.endsWith(".sql"))
  )

  // ❗ out 必须传相对路径，drizzle-kit 会直接拼 `./` 前缀，给绝对路径会变成 `.//abs/path`
  writeFileSync(
    tmpConfigPath,
    `import { defineConfig } from "drizzle-kit"\nexport default defineConfig({ dialect: "sqlite", schema: "./src/db/schema.ts", out: "${tmpMigrationsRel}" })\n`
  )

  const proc = Bun.spawn(
    ["bunx", "drizzle-kit", "generate", "--config", tmpConfigRel],
    { cwd: apiDir, stdout: "pipe", stderr: "pipe" }
  )
  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  // drizzle-kit 遇错时 exit code 可能仍为 0，需探测 stderr
  if (exitCode !== 0 || /\bError\b|ENOENT|Cannot/i.test(stderr)) {
    console.error("❌ drizzle-kit generate failed (exit", exitCode, ")")
    if (stdout.trim()) console.error("── stdout ──\n" + stdout)
    if (stderr.trim()) console.error("── stderr ──\n" + stderr)
    process.exit(1)
  }

  const afterSqls = readdirSync(tmpMigrationsDir).filter((f) =>
    f.endsWith(".sql")
  )
  const newSqls = afterSqls.filter((f) => !beforeSqls.has(f))

  if (newSqls.length > 0) {
    console.error(
      "\n❌ Schema drift detected（schema.ts 与最新 snapshot 不一致）："
    )
    console.error(`  drizzle-kit generate 生成了 ${newSqls.length} 个新迁移：`)
    newSqls.forEach((f) => console.error(`  - ${f}`))
    console.error(
      "\n请运行 cd apps/api && bunx drizzle-kit generate 提交对应迁移"
    )
    process.exit(1)
  }
  console.log(`✅ Schema 一致性校验通过（无待生成迁移）`)
} finally {
  try {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  } catch {
    /* ignore */
  }
}

console.log("✅ Migration pre-check passed")

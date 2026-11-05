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
import { is, Table } from "drizzle-orm"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { getTableConfig } from "drizzle-orm/sqlite-core"

import * as schema from "../src/db/schema.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const apiDir = join(__dirname, "..")
const migrationsFolder = join(apiDir, "drizzle")
const initSqlPath = join(apiDir, "init.sql")

// ── 双来源守卫：init.sql 与 drizzle/ 只能保留一份 ────────────────────────────
// 模板仓库只留 init.sql；scaffold 生成项目会删除 init.sql、只留 drizzle/。
// 两者并存时无法判断哪份是事实源：直接失败，而不是静默按模板模式只检查 init.sql。
if (
  existsSync(initSqlPath) &&
  existsSync(join(migrationsFolder, "meta", "_journal.json"))
) {
  console.error(
    [
      "❌ 检测到多份数据库结构来源并存：",
      `  - ${initSqlPath}`,
      `  - ${migrationsFolder}/`,
      "只保留一份结构来源（模板留 init.sql，生成项目留 drizzle/）：删除多余的一份后重试。",
    ].join("\n")
  )
  process.exit(1)
}

// ── 模板模式：单份 init.sql，无迁移链 ────────────────────────────────────────
// 模板仓库不提交 apps/api/drizzle；schema 变更后必须重新生成 init.sql。
// 这里做两件事：① 校验 init.sql 与 schema.ts 一致（用 db:init:generate 重生成后 diff）；
// ② 在内存库执行 init.sql，确保脚本本身可执行。
if (existsSync(initSqlPath)) {
  try {
    const checkProc = Bun.spawnSync(
      ["bun", "scripts/gen-init-sql.ts", "--check"],
      { cwd: apiDir, stdout: "pipe", stderr: "pipe" }
    )
    if (checkProc.exitCode !== 0) {
      process.stderr.write(new TextDecoder().decode(checkProc.stdout))
      process.stderr.write(new TextDecoder().decode(checkProc.stderr))
      process.exit(1)
    }

    const db = new Database(":memory:")
    const sql = readFileSync(initSqlPath, "utf8")
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
    for (const statement of statements) db.exec(statement)
    db.close()

    console.log(
      "✅ 模板模式：init.sql 与 schema.ts 一致，且能在空库执行（单份初始化脚本，无迁移链）"
    )
    console.log("✅ Migration pre-check passed")
    process.exit(0)
  } catch (err) {
    console.error("❌ 模板模式初始化脚本检查 FAILED:", (err as Error).message)
    process.exit(1)
  }
}

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

// ── Step 1: 全量迁移预检 + 迁移结果 vs schema.ts 结构校验 ─────────────────────
// 只验证「SQL 能执行」不足以证明迁移与 schema.ts 一致（删列/少索引仍会绿），
// 这里在内存库上执行全部迁移后，用 PRAGMA 反查表/列/索引，与 drizzle schema 对比。
try {
  const db = new Database(":memory:")
  const drizzleDb = drizzle(db, { schema })
  migrate(drizzleDb, { migrationsFolder })

  const problems: string[] = []
  const tables = Object.values(schema).filter((value) => is(value, Table))

  for (const table of tables) {
    const config = getTableConfig(table)
    const tableName = config.name

    // 列：迁移结果 vs schema.ts（名称/NOT NULL/主键）
    const columns = db.query(`PRAGMA table_info("${tableName}")`).all() as {
      name: string
      notnull: number
      pk: number
    }[]
    const columnNames = new Set(columns.map((c) => c.name))
    for (const expected of config.columns) {
      if (!columnNames.has(expected.name)) {
        problems.push(`${tableName}.${expected.name} 列在迁移结果中缺失`)
      }
    }
    for (const actual of columns) {
      const expected = config.columns.find((c) => c.name === actual.name)
      if (!expected) {
        problems.push(`${tableName}.${actual.name} 列在 schema.ts 中不存在`)
        continue
      }
      if (Boolean(expected.notNull) !== Boolean(actual.notnull)) {
        problems.push(
          `${tableName}.${actual.name} NOT NULL 与 schema.ts 不一致`
        )
      }
      if (Boolean(expected.primary) !== Boolean(actual.pk)) {
        problems.push(`${tableName}.${actual.name} 主键与 schema.ts 不一致`)
      }
    }

    // 索引：迁移结果 vs schema.ts（名称 + 列顺序）
    const indexRows = db.query(`PRAGMA index_list("${tableName}")`).all() as {
      name: string
    }[]
    const actualIndexes = new Set(
      indexRows
        .map((index) => index.name)
        .filter((name) => !name.startsWith("sqlite_autoindex"))
    )
    const expectedIndexes = new Map<string, string[]>(
      config.indexes.map((index) => [
        index.config.name,
        index.config.columns.map((column) => column.name),
      ])
    )
    // 列级 .unique() 的索引不在 config.indexes 里，SQLite 生成的命名约定为
    // `${table}_${column}_unique`，这里补进期望集合并参与双向对比。
    for (const column of config.columns) {
      if (column.isUnique) {
        expectedIndexes.set(`${tableName}_${column.name}_unique`, [column.name])
      }
    }

    for (const [indexName, expectedColumns] of expectedIndexes) {
      if (!actualIndexes.has(indexName)) {
        problems.push(`${tableName} 索引 ${indexName} 在迁移结果中缺失`)
        continue
      }
      const indexInfo = db.query(`PRAGMA index_info("${indexName}")`).all() as {
        seqno: number
        name: string
      }[]
      const actualColumns = indexInfo
        .sort((a, b) => a.seqno - b.seqno)
        .map((info) => info.name)
      if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
        problems.push(
          `${tableName} 索引 ${indexName} 列不一致（期望 ${expectedColumns.join(",")}，实际 ${actualColumns.join(",")}）`
        )
      }
    }
    for (const actualIndex of actualIndexes) {
      if (!expectedIndexes.has(actualIndex)) {
        problems.push(
          `${tableName} 迁移结果多出 schema.ts 未定义的索引 ${actualIndex}`
        )
      }
    }
  }

  db.close()

  if (problems.length > 0) {
    console.error("❌ 迁移结果与 schema.ts 结构不一致：")
    problems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
  }
  console.log(
    `✅ 全量迁移执行成功且与 schema.ts 结构一致（${tables.length} 张表，PRAGMA introspection）`
  )
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

/**
 * 清理 drizzle-kit 临时目录。
 *
 * 注意 `process.exit()` 不会执行 finally，因此 step2 内的失败分支必须在退出前
 * 显式调用本函数；finally 只兜底正常路径与抛错路径。
 */
function cleanupTmpCheck(): void {
  try {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  } catch {
    /* ignore */
  }
}

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
  // （注意包含 SyntaxError：快照/配置 JSON 损坏时 drizzle-kit 只打印堆栈并仍 exit 0）
  if (exitCode !== 0 || /\bError\b|SyntaxError|ENOENT|Cannot/i.test(stderr)) {
    console.error("❌ drizzle-kit generate failed (exit", exitCode, ")")
    if (stdout.trim()) console.error("── stdout ──\n" + stdout)
    if (stderr.trim()) console.error("── stderr ──\n" + stderr)
    cleanupTmpCheck()
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
    cleanupTmpCheck()
    process.exit(1)
  }
  console.log(`✅ Schema 一致性校验通过（无待生成迁移）`)
} catch (err) {
  console.error("❌ Schema 漂移检测 FAILED:", (err as Error).message)
  cleanupTmpCheck()
  process.exit(1)
} finally {
  cleanupTmpCheck()
}

console.log("✅ Migration pre-check passed")

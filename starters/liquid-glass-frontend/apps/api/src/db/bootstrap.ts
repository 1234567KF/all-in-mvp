/**
 * 数据库自举 — 两种来源自动识别
 *
 * 1. **模板仓库模式**：仓库只提交单份 `apps/api/init.sql`（由 schema.ts 生成），
 *    部署级别无记忆 → 空库时直接执行 init.sql，不维护迁移链；
 *    Docker 构建时把 init.sql 放进 `/app/db-bootstrap/init.sql`。
 * 2. **scaffold 生成项目模式**：仓库带 `apps/api/drizzle/`（scaffold 时从 schema.ts
 *    生成 baseline 迁移），使用 drizzle migrate 正常升级；init.sql 已被删除。
 *    Docker 构建时把 drizzle 放进 `/app/db-bootstrap/drizzle/`。
 *
 * 查找顺序：`DB_BOOTSTRAP_DIR` → `${baseDir}/db-bootstrap` → `baseDir`。
 * 本地开发 baseDir = apps/api（仓库内直接 init.sql 或 drizzle/）。
 *
 * 守卫：init.sql 与 drizzle/ 只能存在一份结构来源。解析候选目录时若两类来源
 * 同时可用（同一目录或不同候选目录），直接抛错而不是静默选 init.sql——静默
 * 选取会让部署实际使用的结构与仓库里“多出来的那份”永久漂移。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Database } from "bun:sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

import type { DrizzleDB } from "./index.js"

const INIT_FILE = "init.sql"
const DRIZZLE_DIR = "drizzle"

/** 判定库是否已初始化的核心表：users 存在即视为结构已就绪 */
const CORE_TABLE = "users"

export type BootstrapKind = "init" | "drizzle"

export interface BootstrapSource {
  kind: BootstrapKind
  /** init.sql 的绝对路径，或 drizzle 迁移目录的绝对路径 */
  path: string
}

/** drizzle 迁移目录是否可用（必须有 journal + 至少一个 .sql） */
function hasDrizzleMigrations(directory: string): boolean {
  if (!existsSync(directory)) return false
  const journal = join(directory, "meta", "_journal.json")
  if (!existsSync(journal)) return false
  return readdirSync(directory).some((file) => file.endsWith(".sql"))
}

function describeSource(source: BootstrapSource): string {
  return source.kind === "init"
    ? `init.sql：${source.path}`
    : `drizzle/：${source.path}`
}

/**
 * 解析数据库自举来源。
 *
 * 同一种来源出现在多个候选目录时按候选顺序取第一个（`DB_BOOTSTRAP_DIR` 优先）；
 * 但 init.sql 与 drizzle/ 两类来源同时可用时直接抛错。
 */
export function resolveBootstrapSource(
  baseDir = process.cwd()
): BootstrapSource {
  const candidates = [
    process.env.DB_BOOTSTRAP_DIR,
    join(baseDir, "db-bootstrap"),
    baseDir,
  ].filter(
    (directory, index, all): directory is string =>
      Boolean(directory) && all.indexOf(directory) === index
  )

  const found: BootstrapSource[] = []
  for (const directory of candidates) {
    const initPath = join(directory, INIT_FILE)
    if (existsSync(initPath)) {
      found.push({ kind: "init", path: initPath })
    }

    const drizzleDir = join(directory, DRIZZLE_DIR)
    if (hasDrizzleMigrations(drizzleDir)) {
      found.push({ kind: "drizzle", path: drizzleDir })
    }
  }

  const kinds = new Set(found.map((source) => source.kind))
  if (kinds.size > 1) {
    throw new Error(
      [
        "检测到多份数据库结构来源并存（init.sql 与 drizzle/ 迁移同时可用），已拒绝启动以避免静默选错。",
        "发现：",
        ...found.map((source) => `  - ${describeSource(source)}`),
        "只保留一份结构来源（模板留 init.sql，生成项目留 drizzle/）：删除多余的一份后重试。",
      ].join("\n")
    )
  }

  if (found.length > 0) return found[0]

  throw new Error(
    [
      "找不到数据库初始化来源（init.sql 或 drizzle/）。",
      `已查找：${candidates.join(", ")}`,
      "模板仓库应存在 apps/api/init.sql；scaffold 生成项目应先在 apps/api 运行 bun run db:generate。",
    ].join("\n")
  )
}

/** 列出库中的业务表（排除 sqlite_ 内部表） */
function listUserTables(sqlite: Database): string[] {
  const rows = sqlite
    .query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

/**
 * 在空库上执行单份 init.sql（drizzle generate 产物用 --> statement-breakpoint 分隔）。
 *
 * - 已有 `users` 核心表 → 视为已初始化，直接跳过（模板部署级别无记忆，存量库保持现状）；
 * - 有其它业务表但缺 `users` → 说明上次初始化没跑完 / 结构不完整，抛可操作错误；
 * - 全部语句包在单个事务里：任一语句失败整体回滚，不留下“半初始化”库。
 */
export function applyInitSql(sqlite: Database, initSqlPath: string): void {
  const existingTables = listUserTables(sqlite)
  if (existingTables.includes(CORE_TABLE)) return

  if (existingTables.length > 0) {
    throw new Error(
      [
        `数据库已有表（${existingTables.join(", ")}），但缺少核心表 "${CORE_TABLE}"，无法判断是否已初始化。`,
        "这通常意味着上次初始化中途失败或数据库结构不完整。",
        "请备份数据后删除数据目录（Docker: /app/data；本地: apps/api/data）并重启，或执行 `bun run db:reset` 重建（会清空本地数据）。",
      ].join("\n")
    )
  }

  const sql = readFileSync(initSqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)

  // DDL 在 SQLite 中可事务化：失败回滚后库保持空态，下次启动可重新完整执行。
  sqlite.transaction(() => {
    for (const statement of statements) {
      sqlite.exec(statement)
    }
  })()
}

/**
 * 按环境自举数据库结构。
 *
 * @returns 实际使用的来源（便于启动日志输出）
 */
export function bootstrapDatabase(
  sqlite: Database,
  drizzleDb: DrizzleDB,
  options: { baseDir?: string } = {}
): BootstrapSource {
  const source = resolveBootstrapSource(options.baseDir)

  if (source.kind === "init") {
    applyInitSql(sqlite, source.path)
  } else {
    migrate(drizzleDb, { migrationsFolder: source.path })
  }

  return source
}

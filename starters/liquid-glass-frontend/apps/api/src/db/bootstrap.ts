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
import { getTableColumns } from "drizzle-orm"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

import type { DrizzleDB } from "./index.js"
import { users } from "./schema.js"

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

/** 某张表在库里的实际列名 */
function listTableColumns(sqlite: Database, table: string): string[] {
  // 绑定值在 .all(...) 处传，而不是 .query(sql, params)——后者不会把参数带进查询，
  // pragma_table_info(?) 拿到空绑定就返回 0 行，等于「所有列都缺」的假阳性
  const rows = sqlite
    .query("SELECT name FROM pragma_table_info(?)")
    .all(table) as { name: string }[]
  return rows.map((row) => row.name)
}

/**
 * 核心表结构与 schema.ts 的列集合比对（模板模式专用）。
 *
 * 为什么必须查：SQLite 有个历史包袱——双引号包裹的标识符解析不到列名时会被当成
 * **字符串字面量**。drizzle 的 select 会列出 `"users"."password"` 这样的显式列名，
 * 所以「库里缺列」既不报错也不返回 undefined，而是返回列名字符串本身。
 * 实测（users 少 password 列）：drizzle 给出 `password: "password"`，
 * 于是登录走到 verifyPassword 并稳定返回「密码错误」——错误码没错、原因全错，
 * 排查会一路指向密码逻辑而不是数据库结构（血案 B030）。
 * 因此在「已有表 → 跳过 init.sql」这条分支上，把结构漂移提前到启动期显式失败。
 *
 * 只检查缺失列，多出的列放过：项目可能在 starter 基础上自行加过列。
 */
export function assertCoreTableMatchesSchema(sqlite: Database): void {
  const actual = new Set(listTableColumns(sqlite, CORE_TABLE))
  const expected = Object.values(getTableColumns(users)).map(
    (column) => column.name
  )
  const missing = expected.filter((name) => !actual.has(name))

  if (missing.length === 0) return

  throw new Error(
    [
      `核心表 "${CORE_TABLE}" 的列结构落后于代码（schema.ts），已缺失列：${missing.join(", ")}。`,
      "模板仓库的结构来源 init.sql 只在空库时执行，不会升级存量库；",
      "继续运行会让查询按错位的列取值（SQLite 把解析不到的双引号标识符当字符串），得到看似合理实则错误的结果。",
      "请备份数据后删除数据目录（Docker: /app/data；本地: apps/api/data）并重启，或执行 `bun run db:reset` 重建（会清空本地数据）。",
    ].join("\n")
  )
}

/**
 * 在空库上执行单份 init.sql（drizzle generate 产物用 --> statement-breakpoint 分隔）。
 *
 * - 已有 `users` 核心表 → 视为已初始化，跳过执行，但先比对列结构（漂移即报错，
 *   见 assertCoreTableMatchesSchema；模板部署级别无记忆，存量库靠 db:reset 升级）；
 * - 有其它业务表但缺 `users` → 说明上次初始化没跑完 / 结构不完整，抛可操作错误；
 * - 全部语句包在单个事务里：任一语句失败整体回滚，不留下“半初始化”库。
 */
export function applyInitSql(sqlite: Database, initSqlPath: string): void {
  const existingTables = listUserTables(sqlite)
  if (existingTables.includes(CORE_TABLE)) {
    assertCoreTableMatchesSchema(sqlite)
    return
  }

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

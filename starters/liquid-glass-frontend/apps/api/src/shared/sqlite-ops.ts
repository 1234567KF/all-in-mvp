/**
 * SQLite 运维工具箱（零表依赖）
 *
 * 只提供 3 个可复用的纯函数，不建 `system_config` 表、不写审计、不挂路由：
 * - `getSqliteStats()`    库文件大小 / 空闲页 / 各表行数（运维面板、健康巡检用）
 * - `runSqliteVacuum()`   `VACUUM + ANALYZE`，返回回收量（手动优化入口用）
 * - `createSqliteBackup()` `VACUUM INTO` 原子快照（WAL 安全）；OSS 模式上传云端并轮转，
 *                          本地模式落盘轮转，两种模式都只保留最近 N 份
 *
 * 设计约束：
 * - 审计与权限属于调用方业务语义（何时触发、谁触发），由 service/route 决定后自行写审计，
 *   本文件不写表、不写审计（副作用仅限：首次调用默认参数时的数据库惰性初始化、文件 IO 与 OSS IO），
 *   便于被脚本、定时任务、测试直接复用。
 * - 备份文件名内嵌时间戳（本地时间 `YYYYMMDDTHHmmss`），保证本地与 OSS 两条链路都能
 *   直接按 key 字典序判断新旧，无需依赖 mtime 或额外元数据。
 * - 备份目录默认 `${DATA_DIR}/backups`；`db` / `dir` / `storage` 均可注入，测试无需真实云环境。
 *
 * 手动验证（在 apps/api 目录执行；默认参数会使用并惰性初始化 apps/api/data，目录已 gitignore）：
 *   cd apps/api
 *   bun -e 'import { getSqliteStats } from "./src/shared/sqlite-ops.ts"; console.log(getSqliteStats())'
 *   bun -e 'import { createSqliteBackup } from "./src/shared/sqlite-ops.ts"; console.log(await createSqliteBackup())'
 */
import { randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs"
import path from "node:path"

import type { Database } from "bun:sqlite"

import { dataDir, getRawSqlite } from "../db.js"
import { reqLog } from "./logger.js"
import {
  deleteOssObjects,
  getOssBackupPrefix,
  isOssMode,
  listOssObjects,
  uploadOssObject,
} from "./oss.js"

// ─── 公共类型 ────────────────────────────────────────────────────────────────

/** 单表行数统计 */
export interface SqliteTableStat {
  name: string
  rows: number
}

/** 数据库整体统计 */
export interface SqliteStats {
  /** 数据库文件路径（内存库为 `:memory:`） */
  path: string
  /** 逻辑库大小（page_count × page_size，字节） */
  sizeBytes: number
  /**
   * 空闲页字节数（freelist_count × page_size）。
   * 注意：它只是「空闲页」的下界，不是 VACUUM 可回收上限——内部碎片不在 freelist 里，
   * VACUUM 实际回收量以 runSqliteVacuum() 的 freedBytes 为准。
   */
  freeBytes: number
  /** -wal 文件大小（字节；非 WAL / 内存库为 0） */
  walBytes: number
  /** 日志模式（wal / delete / memory 等） */
  journalMode: string
  /** 各用户表行数（按表名排序；不含 sqlite_ 内部表） */
  tables: SqliteTableStat[]
}

/** VACUUM 执行结果 */
export interface SqliteVacuumResult {
  /** VACUUM 前逻辑库大小（字节） */
  beforeBytes: number
  /** VACUUM 后逻辑库大小（字节） */
  afterBytes: number
  /**
   * 回收字节数（before - after）。
   * 注意：极小库 VACUUM 后 ANALYZE 会新建 sqlite_stat1，反而可能变小幅负值，
   * 判断「是否回收」请用 freedBytes > 0 而不是回收到正数。
   */
  freedBytes: number
  /** 耗时（毫秒） */
  durationMs: number
}

/**
 * 备份存储适配器。
 * - `local`：快照直接落本地目录，按保留份数轮转；
 * - `oss`：先落本地临时文件，上传后删除本地文件，云端按保留份数轮转。
 * 生产默认由 `isOssMode()` 自动选择；测试可注入假实现（不发真实网络请求）。
 */
export type SqliteBackupStorage =
  | { mode: "local" }
  | {
      mode: "oss"
      /** OSS 对象 key 前缀（含末尾 `/`） */
      prefix: string
      upload: (key: string, localPath: string) => Promise<void>
      list: (prefix: string) => Promise<string[]>
      remove: (keys: string[]) => Promise<string[]>
    }

/** 备份参数（全部可选，默认走进程单例 DB + `${DATA_DIR}/backups` + 30 份） */
export interface SqliteBackupOptions {
  /** 注入 DB 连接（默认 getRawSqlite()） */
  db?: Database
  /** 本地备份目录（默认 `${DATA_DIR}/backups`） */
  dir?: string
  /** 保留最近 N 份（默认 30，必须为正整数） */
  retain?: number
  /** 备份文件名前缀（默认 `backup`；仅允许字母/数字/下划线/短横线） */
  filePrefix?: string
  /** 注入存储适配器（默认按 isOssMode() 自动选择，测试用） */
  storage?: SqliteBackupStorage
}

/** 备份结果 */
export interface SqliteBackupResult {
  /** 备份文件名（OSS 模式下为对象 key 的最后一段） */
  fileName: string
  sizeBytes: number
  sizeMB: number
  /** 实际存储位置 */
  storage: "local" | "oss"
  /** 轮转后保留的备份份数 */
  retainedCount: number
  /** 备份完成时间（ISO 字符串） */
  at: string
}

/** 默认保留备份份数 */
export const DEFAULT_BACKUP_RETAIN = 30

/** 默认备份文件名前缀 */
const DEFAULT_BACKUP_FILE_PREFIX = "backup"

// ─── 内部工具 ────────────────────────────────────────────────────────────────

/** 读取单值 PRAGMA（返回首行首列的数字） */
function readPragmaNumber(db: Database, pragma: string): number {
  const row = db.query(`PRAGMA ${pragma}`).get() as Record<
    string,
    number
  > | null
  if (!row) return 0
  return Number(Object.values(row)[0] ?? 0) || 0
}

/** 读取单值 PRAGMA（返回首行首列的字符串） */
function readPragmaString(db: Database, pragma: string): string {
  const row = db.query(`PRAGMA ${pragma}`).get() as Record<
    string,
    string
  > | null
  if (!row) return ""
  return String(Object.values(row)[0] ?? "")
}

/** 逻辑库大小（字节） */
function logicalSizeBytes(db: Database): number {
  return readPragmaNumber(db, "page_count") * readPragmaNumber(db, "page_size")
}

/** -wal 文件大小（字节；内存库 / 无 WAL 时为 0） */
function walSizeBytes(db: Database): number {
  if (db.filename === ":memory:" || !db.filename) return 0
  const walPath = `${db.filename}-wal`
  try {
    return existsSync(walPath) ? statSync(walPath).size : 0
  } catch {
    return 0
  }
}

/** 统计单表行数（表名来自 sqlite_master，按标识符规则用双引号包裹） */
function countRows(db: Database, table: string): number {
  const quoted = `"${table.replace(/"/g, '""')}"`
  const row = db.query(`SELECT COUNT(*) AS c FROM ${quoted}`).get() as {
    c: number
  } | null
  return Number(row?.c ?? 0) || 0
}

/** 本地时间戳 `YYYYMMDDTHHmmss`（备份文件名用，便于人工识别与字典序排序） */
function localStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return [
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  ].join("T")
}

/** 备份文件名正则（filePrefix 只允许安全字符，无需转义） */
function backupFilePattern(filePrefix: string): RegExp {
  return new RegExp(`^${filePrefix}-\\d{8}T\\d{6}-[a-z0-9]+\\.db$`)
}

/** 归一化并校验文件名前缀（限制字符集，避免路径穿越/非法文件名） */
function normalizeFilePrefix(filePrefix: string): string {
  const normalized = filePrefix.trim()
  if (!normalized || !/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error(
      "filePrefix 只能包含字母/数字/下划线/短横线，例如 backup 或 db-snapshot"
    )
  }
  return normalized
}

/** 校验保留份数 */
function normalizeRetain(retain: number): number {
  if (!Number.isInteger(retain) || retain < 1) {
    throw new Error("retain 必须为正整数")
  }
  return retain
}

/** VACUUM INTO 导出数据库快照（目标已存在时先删除，支持同日重跑） */
function vacuumInto(db: Database, targetPath: string): void {
  if (existsSync(targetPath)) unlinkSync(targetPath)
  // 路径由本文件拼接（无用户输入），单引号转义仍是防御性处理
  db.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`)
}

/**
 * 解析备份存储适配器（生产默认：OSS 优先，否则本地）。
 * 单独导出便于调用方复用默认组装（如自定义后仍想复用 OSS 上传链路），也便于单测覆盖 wiring。
 */
export function resolveBackupStorage(
  override?: SqliteBackupStorage
): SqliteBackupStorage {
  if (override) return override
  if (isOssMode()) {
    return {
      mode: "oss",
      prefix: getOssBackupPrefix(),
      upload: uploadOssObject,
      list: listOssObjects,
      remove: deleteOssObjects,
    }
  }
  return { mode: "local" }
}

/** 按「时间戳升序（旧 → 新）」排序备份文件名，返回需要删除的超额旧备份 */
function pickExcess(
  names: string[],
  retain: number,
  pattern: RegExp
): string[] {
  const backups = names
    .filter((name) => pattern.test(path.basename(name)))
    .sort((a, b) => a.localeCompare(b))
  return backups.slice(0, Math.max(0, backups.length - retain))
}

/** 统计符合备份命名规则的文件/对象数量 */
function countBackups(names: string[], pattern: RegExp): number {
  return names.filter((name) => pattern.test(path.basename(name))).length
}

// ─── 统计 ────────────────────────────────────────────────────────────────────

/**
 * 获取数据库统计（大小 / 空闲页 / 各表行数）。
 *
 * 只读查询（PRAGMA + COUNT，不修改库），但两点开销需知：
 * - 未显式传 `db` 时默认参数会触发数据库惰性初始化（建库 / 迁移 / 播种）；
 * - 各表行数用 COUNT(*)，大表会全表扫描，运维面板建议低峰期或用显式连接调用。
 */
export function getSqliteStats(db: Database = getRawSqlite()): SqliteStats {
  const pageSize = readPragmaNumber(db, "page_size")
  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map(({ name }) => ({ name, rows: countRows(db, name) }))

  return {
    path: db.filename,
    sizeBytes: logicalSizeBytes(db),
    freeBytes: readPragmaNumber(db, "freelist_count") * pageSize,
    walBytes: walSizeBytes(db),
    journalMode: readPragmaString(db, "journal_mode"),
    tables,
  }
}

// ─── 优化 ────────────────────────────────────────────────────────────────────

/**
 * 执行 `VACUUM + ANALYZE` 并返回回收量。
 *
 * 注意：
 * - VACUUM 不能在事务中执行，本函数要求是事务边界（bun:sqlite 的 exec 为自动提交）；
 * - VACUUM 期间会持有排他锁，大库请放在低峰期由运维入口触发；
 * - WAL 模式下顺带 `wal_checkpoint(TRUNCATE)` 截断 -wal 文件，失败（如被占用）不中断。
 */
export function runSqliteVacuum(
  db: Database = getRawSqlite()
): SqliteVacuumResult {
  const start = performance.now()
  const beforeBytes = logicalSizeBytes(db)

  db.exec("VACUUM")
  db.exec("ANALYZE")
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)")
  } catch {
    // 非 WAL 模式或 -wal 被占用：优化本身已成功，截断失败只影响 -wal 文件大小
  }

  const afterBytes = logicalSizeBytes(db)
  return {
    beforeBytes,
    afterBytes,
    freedBytes: beforeBytes - afterBytes,
    durationMs: Math.round(performance.now() - start),
  }
}

// ─── 备份 ────────────────────────────────────────────────────────────────────

/**
 * 创建数据库快照。
 *
 * 流程：`VACUUM INTO` 本地快照（WAL 安全、原子）→ OSS 模式上传云端并删除本地临时文件，
 * 本地模式保留在备份目录；两种模式都按文件名时间戳轮转，只保留最近 `retain` 份。
 *
 * 失败语义：快照/上传失败时错误向上抛（由调用方决定审计与提示），本地临时文件
 * 在 OSS 上传失败时也会被清理，避免 OSS 故障期间孤儿文件跨日累积。
 * 并发语义：VACUUM / VACUUM INTO 会持有排他锁，调用方应自行串行化（如定时任务加防重入锁），
 * 本函数不内置锁。
 */
export async function createSqliteBackup(
  options: SqliteBackupOptions = {}
): Promise<SqliteBackupResult> {
  const db = options.db ?? getRawSqlite()
  const retain = normalizeRetain(options.retain ?? DEFAULT_BACKUP_RETAIN)
  const filePrefix = normalizeFilePrefix(
    options.filePrefix ?? DEFAULT_BACKUP_FILE_PREFIX
  )
  const dir = options.dir ?? path.join(dataDir, "backups")
  const storage = resolveBackupStorage(options.storage)
  const pattern = backupFilePattern(filePrefix)

  const fileName = `${filePrefix}-${localStamp()}-${randomUUID().slice(0, 8)}.db`
  const localPath = path.join(dir, fileName)

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  vacuumInto(db, localPath)

  const sizeBytes = statSync(localPath).size
  const sizeMB = Math.round((sizeBytes / 1024 / 1024) * 100) / 100

  let retainedCount: number
  if (storage.mode === "oss") {
    const key = `${storage.prefix}${fileName}`
    try {
      await storage.upload(key, localPath)
    } finally {
      // 无论上传成败都清理本地临时快照
      if (existsSync(localPath)) unlinkSync(localPath)
    }

    const keys = await storage.list(storage.prefix)
    const excess = pickExcess(keys, retain, pattern)
    if (excess.length > 0) {
      reqLog().info(
        { module: "sqlite-ops", count: excess.length },
        "backup.oss.prune"
      )
      await storage.remove(excess)
      // 默认 OSS 适配器会吞掉单批删除失败，按「期望删除数」算 retainedCount 会虚报；
      // 重新列举以实际剩余对象为准（备份频率低，多一次 list 可接受）。
      retainedCount = countBackups(await storage.list(storage.prefix), pattern)
    } else {
      retainedCount = countBackups(keys, pattern)
    }
  } else {
    const files = readdirSync(dir)
    const excess = pickExcess(files, retain, pattern)
    for (const file of excess) {
      try {
        unlinkSync(path.join(dir, file))
      } catch (err) {
        // 单个旧备份删除失败不中断（下一次备份会再次尝试轮转）
        reqLog().warn(
          { err, module: "sqlite-ops", file },
          "backup.local.prune_failed"
        )
      }
    }
    // 单个旧备份删除失败只记日志，这里以实际剩余文件为准，避免 retainedCount 虚报
    retainedCount = countBackups(readdirSync(dir), pattern)
  }

  return {
    fileName,
    sizeBytes,
    sizeMB,
    storage: storage.mode,
    retainedCount,
    at: new Date().toISOString(),
  }
}

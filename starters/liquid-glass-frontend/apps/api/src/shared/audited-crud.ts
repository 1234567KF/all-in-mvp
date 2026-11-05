/**
 * 声明式审计 CRUD Helper
 * 通用泛型函数收拢「Diff -> 记日志」，消除 writeLog 样板代码
 *
 * 设计：
 * - "先写后审"模式：Service 自行执行 db 写操作，再调本模块完成 diff + log
 * - before row 由 Service 传入（避免重复 SELECT）
 * - 自动排除噪声列（updateTime/updaterId/createTime/creatorId/id）
 * - fieldLabels 保证 changes key 为中文，与前端展示一致
 * - snapshot 白名单过滤敏感/无关列
 * - TableAuditConfig 由各业务模块内联声明（如 USER_AUDIT_CONFIG）
 */
import { AUDIT_EVENT_TYPES } from "shared"

import { buildChanges, buildDetail } from "../utils/change-diff.js"
import { writeLog } from "./audit-log.js"
import type { OpCtx } from "./op-context.js"

// ─── 类型 ─────────────────────────────────────────────────────────────────────

/** 表级审计配置（声明化核心） */
export interface TableAuditConfig {
  /** 审计模块名（AUDIT_MODULES.XXX） */
  module: string
  /** 列名 → 中文标签映射 */
  fieldLabels: Record<string, string>
  /** diff 排除列（追加到全局默认之上） */
  excludeColumns?: string[]
  /** create/delete snapshot 白名单（仅记录这些列） */
  snapshotColumns?: string[]
  /** JSON 字符串列（diff 前需 parse） */
  jsonColumns?: string[]
}

/** auditedUpdate 参数 */
export interface AuditedUpdateOpts {
  /** 写入前的完整行（service 已有的 existing，接受具体行类型） */
  before: object
  /** 实际 set 的数据 */
  data: object
  /** 操作上下文 */
  ctx: OpCtx
  /** 表级审计配置 */
  config: TableAuditConfig
  /** 审计元数据 */
  meta: {
    target: string
    targetId?: string
    detail?: string
    eventType?: string
    severity?: string
    result?: string
    /** 覆盖 config.module */
    module?: string
  }
}

/** auditedInsert 参数 */
export interface AuditedInsertOpts {
  /** 新插入的行（完整或关键列子集） */
  row: object
  ctx: OpCtx
  config: TableAuditConfig
  meta: {
    target: string
    targetId?: string
    detail?: string
    /** 覆盖 config.module */
    module?: string
  }
}

/** auditedDelete 参数 */
export interface AuditedDeleteOpts {
  /** 删除前的完整行 */
  before: object
  ctx: OpCtx
  config: TableAuditConfig
  meta: {
    target: string
    targetId?: string
    detail?: string
    /** 覆盖 config.module */
    module?: string
  }
}

// ─── 全局默认排除列 ───────────────────────────────────────────────────────────

const DEFAULT_EXCLUDE = [
  "id",
  "updateTime",
  "updaterId",
  "createTime",
  "creatorId",
]

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

/** 将具体行类型收敛为通用 Record（单点转换，调用方无需强转） */
function asRow(obj: object): Record<string, unknown> {
  return obj as Record<string, unknown>
}

/** 从 OpCtx 提取 writeLog 公共参数 */
function ctxToLogParams(ctx: OpCtx) {
  return {
    operator: ctx.operator,
    operatorId: ctx.operatorId,
    operatorAccount: ctx.operatorAccount,
    operatorRole: ctx.operatorRole,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  }
}

/** 按白名单提取 snapshot 列 */
function pickSnapshot(
  row: Record<string, unknown>,
  config: TableAuditConfig
): Record<string, unknown> {
  const cols = config.snapshotColumns
  if (!cols || cols.length === 0) return row
  const result: Record<string, unknown> = {}
  for (const col of cols) {
    if (col in row) result[col] = row[col]
  }
  return result
}

/** 对 JSON 列进行 parse（用于 diff 前标准化） */
function parseJsonColumns(
  obj: Record<string, unknown>,
  config: TableAuditConfig
): Record<string, unknown> {
  const jsonCols = config.jsonColumns
  if (!jsonCols || jsonCols.length === 0) return obj
  const result = { ...obj }
  for (const col of jsonCols) {
    if (typeof result[col] === "string") {
      try {
        result[col] = JSON.parse(result[col] as string)
      } catch {
        // 解析失败保留原值
      }
    }
  }
  return result
}

// ─── 核心 API ─────────────────────────────────────────────────────────────────

/**
 * 审计化 Update — 自动 diff + 写日志
 *
 * 使用模式（先写后审）：
 * ```ts
 * const existing = db.select().from(table).where(...).get()!
 * db.update(table).set(merged).where(...).run()
 * auditedUpdate({ before: existing, data: merged, ctx, config, meta })
 * ```
 */
export function auditedUpdate(opts: AuditedUpdateOpts): void {
  const { ctx, config, meta } = opts
  const before = asRow(opts.before)
  const data = asRow(opts.data)
  const exclude = [...DEFAULT_EXCLUDE, ...(config.excludeColumns ?? [])]

  // 过滤排除列
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([k]) => !exclude.includes(k))
  )

  if (Object.keys(filteredData).length === 0) return

  // JSON 列 parse 后对比
  const beforeParsed = parseJsonColumns(before, config)
  const dataParsed = parseJsonColumns(filteredData, config)

  const changes = buildChanges(beforeParsed, dataParsed, config.fieldLabels)

  if (Object.keys(changes).length === 0 && meta.detail === undefined) return

  writeLog({
    ...ctxToLogParams(ctx),
    module: meta.module ?? config.module,
    eventType: meta.eventType ?? AUDIT_EVENT_TYPES.UPDATE,
    target: meta.target,
    targetId: meta.targetId,
    detail: meta.detail ?? buildDetail(changes),
    severity: meta.severity,
    result: meta.result,
    changes,
  })
}

/**
 * 审计化 Insert — 自动生成 snapshot + 写日志
 *
 * 使用模式：
 * ```ts
 * db.insert(table).values(values).run()
 * auditedInsert({ row: values, ctx, config, meta })
 * ```
 */
export function auditedInsert(opts: AuditedInsertOpts): void {
  const { ctx, config, meta } = opts

  const snapshot = parseJsonColumns(
    pickSnapshot(asRow(opts.row), config),
    config
  )

  writeLog({
    ...ctxToLogParams(ctx),
    module: meta.module ?? config.module,
    eventType: AUDIT_EVENT_TYPES.CREATE,
    target: meta.target,
    targetId: meta.targetId,
    detail: meta.detail ?? `新增${config.module}：${meta.target}`,
    changes: {
      snapshot: { before: null, after: snapshot },
    },
  })
}

/**
 * 审计化 Delete — 自动生成 snapshot + 写日志
 *
 * 使用模式：
 * ```ts
 * const existing = db.select().from(table).where(...).get()!
 * db.delete(table).where(...).run()
 * auditedDelete({ before: existing, ctx, config, meta })
 * ```
 */
export function auditedDelete(opts: AuditedDeleteOpts): void {
  const { ctx, config, meta } = opts

  const snapshot = parseJsonColumns(
    pickSnapshot(asRow(opts.before), config),
    config
  )

  writeLog({
    ...ctxToLogParams(ctx),
    module: meta.module ?? config.module,
    eventType: AUDIT_EVENT_TYPES.DELETE,
    target: meta.target,
    targetId: meta.targetId,
    detail: meta.detail ?? `删除${config.module}：${meta.target}`,
    severity: "warning",
    changes: {
      snapshot: { before: snapshot, after: null },
    },
  })
}

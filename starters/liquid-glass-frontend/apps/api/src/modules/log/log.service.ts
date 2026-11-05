/**
 * Log 服务层 — 审计日志只读查询
 *
 * 设计边界：
 * - 只读：不写审计、不接 OpCtx（写审计由 shared/audit-log.ts 的 writeLog 统一负责）；
 * - 查询能力收拢在 service：route 只做参数校验与响应封装（B2 门禁禁止 route 直连 DB）；
 * - changes 列落库为 JSON 字符串，对外统一解析成结构化对象；解析失败按 null 处理
 *   （坏数据不能拖垮整页查询）。
 */
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm"
import type { AuditLog, AuditLogQuery, PagedResult } from "shared"
import { AuditChangesSchema } from "shared"

import { getDrizzle } from "../../db.js"
import { auditLogs } from "../../db/schema.js"

type AuditLogRow = typeof auditLogs.$inferSelect

/** LIKE 通配符转义（配合 ESCAPE '\'，防用户输入 % / _ 扩大匹配范围） */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** DB 行 → wire（nullable 列按空串兜底；changes JSON 字符串解析为对象） */
function toWireLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    operator: row.operator ?? "",
    operatorId: row.operatorId ?? "",
    operatorAccount: row.operatorAccount ?? "",
    operatorRole: row.operatorRole ?? "",
    eventType: row.eventType ?? "",
    module: row.module ?? "",
    target: row.target ?? "",
    targetId: row.targetId ?? "",
    ipAddress: row.ipAddress ?? "",
    result: row.result ?? "",
    severity: row.severity ?? "",
    detail: row.detail ?? "",
    userAgent: row.userAgent ?? "",
    requestId: row.requestId ?? "",
    changes: parseChanges(row.changes),
    createTime: row.createTime,
  }
}

/**
 * changes 列（JSON 字符串）→ 结构化对象
 *
 * 用 shared 的 AuditChangesSchema 做结构校验，坏数据（坏 JSON / snapshot 为 null /
 * 字段值不是 {before,after}）统一按 null 处理：宁可不展示变更明细，也不让
 * 一条脏数据把整个查询或详情弹窗拖崩。
 */
function parseChanges(raw: string | null): AuditLog["changes"] {
  if (!raw) return null
  try {
    const parsed = AuditChangesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * 审计日志多维筛选 + 偏移分页查询
 *
 * - keyword 模糊匹配操作人 / 账号 / 审计对象 / 详情（LIKE 已转义，输入 % 按字面量处理）；
 * - 时间范围对 text 列按 ISO 字典序比较（前端传 getLocalDayBoundaryISO 的完整 ISO）；
 * - 固定 createTime 倒序，不暴露可排序列。
 */
export function listAuditLogs(query: AuditLogQuery): PagedResult<AuditLog> {
  const db = getDrizzle()
  const conditions = []

  if (query.module) conditions.push(eq(auditLogs.module, query.module))
  if (query.eventType) {
    conditions.push(eq(auditLogs.eventType, query.eventType))
  }
  if (query.result) conditions.push(eq(auditLogs.result, query.result))
  if (query.severity) conditions.push(eq(auditLogs.severity, query.severity))

  if (query.keyword) {
    const pattern = `%${escapeLike(query.keyword)}%`
    conditions.push(
      sql`(
        ${auditLogs.operator} LIKE ${pattern} ESCAPE '\\'
        OR ${auditLogs.operatorAccount} LIKE ${pattern} ESCAPE '\\'
        OR ${auditLogs.target} LIKE ${pattern} ESCAPE '\\'
        OR ${auditLogs.detail} LIKE ${pattern} ESCAPE '\\'
      )`
    )
  }

  if (query.startTime) {
    conditions.push(gte(auditLogs.createTime, query.startTime))
  }
  if (query.endTime) {
    conditions.push(lte(auditLogs.createTime, query.endTime))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const total =
    db.select({ value: count() }).from(auditLogs).where(where).get()?.value ?? 0

  const rows = db
    .select()
    .from(auditLogs)
    .where(where)
    // createTime 相同时按 id 倒序兜底：offset 分页下必须有全序，否则同毫秒多行
    // 在翻页/并发写入时可能重复或漏行（与 notification 游标分页同款 tiebreaker）。
    .orderBy(desc(auditLogs.createTime), desc(auditLogs.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all()

  return {
    items: rows.map(toWireLog),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
  }
}

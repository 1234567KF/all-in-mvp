/**
 * Notification 服务层 — 业务无关消息通知内核（收件箱读写）
 *
 * 职责：列表游标分页 / 未读数 / 单条已读 / 全部已读 / 删除。写入（notify）在
 * shared/notification.ts，本层只面向「当前登录用户自己的收件箱」。
 *
 * 收件人一律由 route 从 JWT 取（opCtx.operatorId），本层不提供「按客户端传参
 * 查询他人收件箱」的能力；所有写操作都带 recipientId 条件，天然越权防护。
 *
 * ⚠️ 审计例外（有意为之，勿直接照抄到其他模块）：
 * 通知的「已读 / 已读全部 / 删除」**不写审计日志**。理由：
 * - 这是用户对**自己收件箱**的高频轻量状态操作（点开列表即已读），不涉及
 *   管理侧敏感数据变更，也不产生跨用户影响；
 * - 逐条写审计会让 audit_logs 随 UI 点击量膨胀，且这类记录没有追溯价值。
 * 例外边界：**管理端批量清理任务不在本模块**。若后续新增「管理员清理/批量
 * 删除通知」入口，必须走 createAuditor + 审计（记录操作人/条件/数量），
 * 不得复用本文件的 deleteNotification。其余业务模块仍遵循 AGENTS.md 的
 * 「写操作 + 审计」约定。
 */
import { and, count, desc, eq, lt, or, type SQL } from "drizzle-orm"
import {
  type Notification,
  type NotificationListQuery,
  type NotificationPage,
} from "shared"

import { getDrizzle } from "../../db.js"
import { resetDemoNotifications } from "../../db/demo-seed.js"
import { notifications } from "../../db/schema.js"
import { toWireNotification } from "../../shared/notification.js"
import { ServiceError } from "../../shared/service-error.js"

// ─── 错误类型 ─────────────────────────────────────────────────────────────────

/**
 * 消息不存在 / 不属于当前用户（统一 404，不暴露他人消息的存在性）。
 */
export class NotificationNotFoundError extends ServiceError {
  constructor() {
    super("消息不存在", 404, "NOTIFICATION_NOT_FOUND")
    this.name = "NotificationNotFoundError"
  }
}

/** 游标格式非法（400，由 route 层 mapServiceError 转 HTTP） */
export class NotificationCursorInvalidError extends ServiceError {
  constructor() {
    super("cursor 无效", 400, "VALIDATION_ERROR")
    this.name = "NotificationCursorInvalidError"
  }
}

// ─── 游标编解码 ───────────────────────────────────────────────────────────────
// 游标对客户端不透明：`createTime|id`。createTime 是共享契约里约定的主排序键，
// id 是同一毫秒内的兜底 tie-breaker —— 只带 createTime 会在同刻多条时跨页漏数。
// 兼容纯 createTime 游标（旧客户端/手工调用）：此时退化为仅按时间过滤。

const CURSOR_SEPARATOR = "|"

interface DecodedCursor {
  createTime: string
  id: string | null
}

/** 由本页最后一条构造下一页游标 */
export function encodeCursor(item: Pick<Notification, "createTime" | "id">) {
  return `${item.createTime}${CURSOR_SEPARATOR}${item.id}`
}

/** 解析游标；空串/时间不可解析视为非法游标 */
export function decodeCursor(cursor: string): DecodedCursor {
  const raw = cursor.trim()
  if (!raw) throw new NotificationCursorInvalidError()

  const index = raw.lastIndexOf(CURSOR_SEPARATOR)
  const createTime = index === -1 ? raw : raw.slice(0, index)
  const id = index === -1 ? null : raw.slice(index + 1) || null

  if (!createTime || Number.isNaN(Date.parse(createTime))) {
    throw new NotificationCursorInvalidError()
  }
  return { createTime, id }
}

// ─── Service 方法 ─────────────────────────────────────────────────────────────

/**
 * 当前用户的通知列表（createTime 倒序游标分页）。
 *
 * 响应形状即 shared 的 NotificationPageSchema：{ items, nextCursor, hasMore }。
 * nextCursor 为 null 表示没有下一页。
 */
export function listNotifications(
  recipientId: string,
  query: NotificationListQuery
): NotificationPage {
  const conditions: (SQL | undefined)[] = [
    eq(notifications.recipientId, recipientId),
  ]

  if (query.unreadOnly) {
    conditions.push(eq(notifications.isRead, 0))
  }

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor)
    // 同一 createTime 下按 id 倒序兜底；只带时间的旧游标退化为时间过滤
    conditions.push(
      cursor.id
        ? or(
            lt(notifications.createTime, cursor.createTime),
            and(
              eq(notifications.createTime, cursor.createTime),
              lt(notifications.id, cursor.id)
            )
          )
        : lt(notifications.createTime, cursor.createTime)
    )
  }

  const rows = getDrizzle()
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createTime), desc(notifications.id))
    .limit(query.limit + 1) // 多取一条判断是否还有下一页
    .all()

  const hasMore = rows.length > query.limit
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows
  const items = pageRows.map(toWireNotification)

  return {
    items,
    nextCursor:
      hasMore && items.length > 0
        ? encodeCursor(items[items.length - 1])
        : null,
    hasMore,
  }
}

/** 当前用户未读消息数 */
export function getUnreadCount(recipientId: string): number {
  const row = getDrizzle()
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.isRead, 0)
      )
    )
    .get()
  return row?.count ?? 0
}

/**
 * 标记单条已读（幂等）。
 *
 * - 消息不存在/不属于当前用户 → 404；
 * - 已读状态重复调用不刷新 readTime，只回读当前行（保持首次已读时间语义）。
 */
export function markRead(recipientId: string, id: string): Notification {
  const db = getDrizzle()
  // 条件更新（isRead=0）：并发标记时只有第一次会写入 readTime，
  // 不会用后到的请求覆盖首次已读时间。
  const updated = db
    .update(notifications)
    .set({ isRead: 1, readTime: new Date().toISOString() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientId, recipientId),
        eq(notifications.isRead, 0)
      )
    )
    .returning()
    .get()

  if (updated) return toWireNotification(updated)

  // 未命中：要么本来就已读（幂等返回现状），要么不存在/不属于当前用户（404）
  const existing = db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.id, id), eq(notifications.recipientId, recipientId))
    )
    .get()

  if (!existing) throw new NotificationNotFoundError()
  return toWireNotification(existing)
}

/**
 * 全部标记已读（可选按不透明 type 过滤）。
 *
 * @returns 本次实际更新的条数（已读的不重复更新/计数）
 */
export function markAllRead(recipientId: string, type?: string): number {
  const conditions: (SQL | undefined)[] = [
    eq(notifications.recipientId, recipientId),
    eq(notifications.isRead, 0),
  ]
  // 未传 type（undefined）= 全部；空字符串由 route 层拒绝，避免静默扩大范围。
  // type 是业务不透明字符串，这里不做 trim/大小写归一化。
  if (type !== undefined) conditions.push(eq(notifications.type, type))

  const updated = getDrizzle()
    .update(notifications)
    .set({ isRead: 1, readTime: new Date().toISOString() })
    .where(and(...conditions))
    .returning({ id: notifications.id })
    .all()

  return updated.length
}

/**
 * 删除单条通知（仅本人；幂等语义：已不存在 → 404）。
 *
 * 该操作不写审计，理由见文件头「审计例外」。
 */
export function deleteNotification(recipientId: string, id: string): void {
  const deleted = getDrizzle()
    .delete(notifications)
    .where(
      and(eq(notifications.id, id), eq(notifications.recipientId, recipientId))
    )
    .returning({ id: notifications.id })
    .all()

  if (deleted.length === 0) throw new NotificationNotFoundError()
}

// ─── Demo 专用（仅 dev/test 入口；生产不暴露）───────────────────────────────
// 收拢在 service 层：route 不允许直连 db/demo-seed，demo 端点的数据操作也走本层。

/** demo 专用端点：恢复演示收件箱（仅由 dev/test 入口调用，生产不暴露） */
export function resetDemoInbox(): number {
  return resetDemoNotifications(getDrizzle())
}

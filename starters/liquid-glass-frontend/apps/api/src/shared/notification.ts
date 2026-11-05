/**
 * 消息通知写入内核 — 落库 + 进程内实时推送
 *
 * 业务无关：只认「收件人 + 不透明 type + 标题/正文 + 业务 payload + 幂等键」，
 * 不引入任何业务枚举；type / payload 的含义由业务方自行约定。
 *
 * 不变量（按优先级）：
 * 1. **先校验再落库、先落库后 publish**：写入参数先按 shared 的 NotificationSchema
 *    校验并归一化（type/recipientId 非空、payload 必须是普通对象、createTime 可解析），
 *    **校验失败不会产生任何 DB 行**；只有 insert 成功（返回行）才广播，SSE 订阅者
 *    收到的每一条消息都一定已持久化，刷新页面后仍可见。
 * 2. **dedupeKey 幂等**：`(recipientId, dedupeKey)` 唯一索引 + ON CONFLICT
 *    DO NOTHING；命中冲突时静默跳过（返回 null / 不进返回数组），**不抛错**，
 *    调用方可安全地在重试、轮询、消息回放等场景重复调用。
 * 3. **notify 抛错、notifySafe 不抛**：notify 把校验/数据库等异常直接抛给调用方；
 *    notifySafe 捕获后写 logger 并返回 null —— 通知是「尽力而为」的旁路能力，
 *    业务主流程（如审批提交）不应因通知失败而失败。
 *
 * ⚠️ 事务约束：**禁止在外层业务事务内调用 notify / notifyMany**。
 * drizzle + bun:sqlite 的嵌套事务使用 savepoint，内层函数返回时外层事务尚未提交；
 * 此时 publish 出去的实时消息在外层回滚后会「推送过但库里没有」。需要与业务写入
 * 保持原子性时，请先提交业务事务，再调用通知内核。本文件注释中的「事务已提交」
 * 仅指 notifyMany 自己的批量写入事务。
 *
 * 幂等键说明：不传或传空串/纯空白 dedupeKey 时列为 NULL；SQLite 唯一索引视 NULL
 * 互不相等，因此不带幂等键的消息可重复写入（这是预期行为）。
 */
import { randomUUID } from "node:crypto"

import { type Notification, NotificationSchema } from "shared"

import { getDrizzle } from "../db.js"
import { notifications } from "../db/schema.js"
import { reqLog } from "./logger.js"
import { notificationBus } from "./notification-bus.js"
import { ValidationError } from "./service-error.js"

// ─── 输入类型 ────────────────────────────────────────────────────────────────

/** 单条通知写入参数 */
export interface NotifyInput {
  /** 收件人标识（必须由服务端从 JWT 等可信来源取得，禁止透传客户端入参） */
  recipientId: string
  /** 不透明业务类型 key，内核不解释、不校验枚举（仅要求非空字符串） */
  type: string
  title: string
  /** 正文纯文本，缺省空串 */
  content?: string
  /** 业务扩展载荷（href / relatedCode / sender 等），内核不解释；必须是普通对象 */
  payload?: Record<string, unknown> | null
  /** 幂等键：同一收件人 + 同一 dedupeKey 只落一条，冲突静默跳过 */
  dedupeKey?: string | null
  /** 显式创建时间（ISO）；用于补数据/测试，缺省取当前时间，写入前归一化为 ISO */
  createTime?: string
}

/** 批量写入参数（收件人由 recipients 数组给出） */
export type NotifyManyInput = Omit<NotifyInput, "recipientId">

/** notifications 表行类型（service 层复用） */
export type NotificationRow = typeof notifications.$inferSelect

// ─── 内部工具 ────────────────────────────────────────────────────────────────

/** DB 行 → wire 契约（用 shared schema 兜底校验，防止 DB 脏值泄漏到 HTTP/SSE） */
export function toWireNotification(row: NotificationRow): Notification {
  return NotificationSchema.parse({
    id: row.id,
    recipientId: row.recipientId,
    type: row.type,
    title: row.title,
    content: row.content,
    payload: row.payload,
    isRead: row.isRead,
    readTime: row.readTime,
    createTime: row.createTime,
  })
}

/** 归一化 createTime：非法时间直接拒绝（否则会污染游标分页） */
function normalizeCreateTime(value: string | undefined): string {
  const date = value === undefined ? new Date() : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("createTime 不是合法时间")
  }
  return date.toISOString()
}

/** 归一化幂等键：空串/纯空白视为不传（NULL），避免变成"吞消息"的有效唯一键 */
function normalizeDedupeKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * 写库前构造并校验 wire 对象：校验失败在 insert 之前抛出，不会留下毒行。
 * 同时把 createTime 归一化为 UTC ISO（带时区偏移的输入会统一成 Z，保证游标排序一致）。
 */
function buildWireNotification(id: string, input: NotifyInput): Notification {
  const candidate = {
    id,
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    content: input.content ?? "",
    payload: input.payload ?? null,
    isRead: 0,
    readTime: null,
    createTime: normalizeCreateTime(input.createTime),
  }

  const parsed = NotificationSchema.safeParse(candidate)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const path = first?.path.join(".") || "notification"
    throw new ValidationError(
      `消息参数不合法（${path}）：${first?.message ?? "校验失败"}`
    )
  }
  return parsed.data
}

/** wire → 待插入行（字段与校验后的 wire 一一对应） */
function toInsertValues(wire: Notification, dedupeKey: string | null) {
  return {
    id: wire.id,
    recipientId: wire.recipientId,
    type: wire.type,
    title: wire.title,
    content: wire.content,
    payload: wire.payload ?? null,
    isRead: wire.isRead,
    readTime: wire.readTime ?? null,
    createTime: wire.createTime,
    dedupeKey,
  }
}

/** 落库（dedupe 冲突返回 undefined） */
function insertWire(
  wire: Notification,
  dedupeKey: string | null
): NotificationRow | undefined {
  return getDrizzle()
    .insert(notifications)
    .values(toInsertValues(wire, dedupeKey))
    .onConflictDoNothing()
    .returning()
    .get()
}

// ─── 公开 API ────────────────────────────────────────────────────────────────

/**
 * 写入一条通知并实时推送。
 *
 * @returns 落库成功时返回 wire Notification；dedupeKey 冲突被跳过时返回 null。
 * @throws ValidationError（参数不合法，不落库）/ 数据库等基础设施异常
 *         （选择 notifySafe 可避免中断业务主流程）
 */
export function notify(input: NotifyInput): Notification | null {
  const wire = buildWireNotification(randomUUID(), input)
  const row = insertWire(wire, normalizeDedupeKey(input.dedupeKey))
  if (!row) return null

  const notification = toWireNotification(row)
  // 先落库（上面已成功）后 publish —— SSE 客户端收到的消息必然可再次查询到
  notificationBus.publish(notification)
  return notification
}

/**
 * 批量写入：同一内容发给多个收件人（如公告扇出）。
 *
 * - 收件人自动去重；**所有收件人的参数先逐条校验，全部合法才进入写库事务**；
 * - 整批落库在一个事务内完成，本批事务提交成功后统一 publish（不会出现
 *   「部分已推送、但本批事务回滚」的中间态被订阅者看到）；
 * - 命中 dedupeKey 的收件人静默跳过，返回值只包含实际写入的消息；
 * - ⚠️ 禁止在调用方的外层业务事务内使用（savepoint 提交 ≠ 外层提交，见文件头）。
 */
export function notifyMany(
  recipients: readonly string[],
  input: NotifyManyInput
): Notification[] {
  const uniqueRecipients = [...new Set(recipients)]
  if (uniqueRecipients.length === 0) return []

  const dedupeKey = normalizeDedupeKey(input.dedupeKey)
  // 写库前先把所有收件人的消息校验并归一化，避免事务里才发现非法输入
  const wires = uniqueRecipients.map((recipientId) =>
    buildWireNotification(randomUUID(), { ...input, recipientId })
  )

  const db = getDrizzle()
  const created = db.transaction((tx) =>
    wires.flatMap((wire) => {
      const row = tx
        .insert(notifications)
        .values(toInsertValues(wire, dedupeKey))
        .onConflictDoNothing()
        .returning()
        .get()
      return row ? [toWireNotification(row)] : []
    })
  )

  // 本批写入事务已提交：统一推送
  for (const notification of created) {
    notificationBus.publish(notification)
  }
  return created
}

/**
 * notify 的容错版本：捕获异常并写 logger，返回 null（校验失败时不会落库）。
 *
 * 适用场景：业务主流程内的旁路通知（通知失败不应影响主流程成功）。
 * 若调用方需要感知失败（如后台任务补发），请直接用 notify。
 */
export function notifySafe(input: NotifyInput): Notification | null {
  try {
    return notify(input)
  } catch (err) {
    reqLog().error(
      { err, recipientId: input.recipientId, type: input.type },
      "notification.notify.failed"
    )
    return null
  }
}

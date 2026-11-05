/**
 * 消息通知 — 业务无关的通用契约（api / web 共用单一事实源）
 *
 * 设计边界（沉淀原则）：
 * - 内核只认「收件人 + 类型 + 标题/正文 + 业务载荷 + 已读状态」五件事；
 * - `type` 是**不透明字符串**：不做枚举约束、不加 DB check，业务自由定义，
 *   避免通用层随业务增长而改表 / 改公共包；
 * - `payload` 承载业务扩展字段（href / relatedCode / sender 等），内核不解释；
 * - 视图模型的转换（isRead → read、createTime → createdAt、payload.href → href）
 *   由前端 adapter 负责，见 apps/web/src/lib/notification-adapter.ts。
 */
import { z } from "zod"

/** 单条消息 wire schema（DB 行 / HTTP 响应 / SSE data 共用） */
export const NotificationSchema = z.object({
  id: z.string().min(1),
  recipientId: z.string().min(1),
  /** 业务类型 key，内核不约束；前端通过 typeRegistry 映射图标/色调 */
  type: z.string().min(1),
  title: z.string(),
  content: z.string().default(""),
  /** 业务载荷（JSON 对象），供前端 adapter / renderContent 消费 */
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  /** 0 未读 / 1 已读（wire 层保持 DB 原样，UI 侧转 boolean） */
  isRead: z.number().int().min(0).max(1).default(0),
  readTime: z.string().nullable().optional(),
  createTime: z.string(),
})

export type Notification = z.infer<typeof NotificationSchema>

/**
 * 列表查询参数（HTTP query string）
 * 游标分页：`cursor` 是**服务端不透明游标**，客户端应原样回传上一页响应的
 * `nextCursor`（当前实现为 `createTime|id` 组合，同一毫秒按 id 兜底排序防跨页漏数；
 * 也是唯一可以兼容裸 `createTime` 的入参形式）。客户端不要解析或自行拼接。
 */
export const NotificationListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
})

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>

/** 列表响应：items + 下一页游标 */
export const NotificationPageSchema = z.object({
  items: z.array(NotificationSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})

export type NotificationPage = z.infer<typeof NotificationPageSchema>

/** 未读数响应 */
export const NotificationUnreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
})

export type NotificationUnreadCount = z.infer<
  typeof NotificationUnreadCountSchema
>

/** SSE 事件名：api 推送端与 web 订阅端共用，避免魔法字符串漂移 */
export const NOTIFICATION_STREAM_EVENT = "notification"

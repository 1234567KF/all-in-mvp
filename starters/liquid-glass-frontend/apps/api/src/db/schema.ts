import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").default("user"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
})

/**
 * 审计日志表 — 追加式历史记录
 * operatorId 不加 FK 约束：允许记录已删除用户的历史操作
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    operator: text("operator"),
    operatorId: text("operatorId"),
    operatorAccount: text("operatorAccount"),
    operatorRole: text("operatorRole"),
    eventType: text("eventType"),
    module: text("module"),
    target: text("target"),
    targetId: text("targetId"),
    ipAddress: text("ipAddress"),
    result: text("result"),
    severity: text("severity"),
    detail: text("detail"),
    userAgent: text("userAgent"), // 浏览器标识
    requestId: text("requestId"), // 请求关联 ID
    changes: text("changes"), // 结构化变更 JSON
    createTime: text("createTime").notNull(),
  },
  (table) => [
    index("idx_audit_create_time").on(table.createTime),
    index("idx_audit_module").on(table.module),
    index("idx_audit_operator").on(table.operator),
    index("idx_audit_operator_id").on(table.operatorId),
    index("idx_audit_event_type").on(table.eventType),
    index("idx_audit_module_target").on(table.module, table.targetId),
    check(
      "audit_logs_severity_check",
      sql`${table.severity} IN ('info', 'warning', 'error', 'critical')`
    ),
    check(
      "audit_logs_result_check",
      sql`${table.result} IN ('success', 'failure')`
    ),
  ]
)

/**
 * 消息通知表 — 业务无关内核（契约见 packages/shared/src/notification.ts）
 *
 * 设计边界：
 * - `type` 是不透明业务字符串：**不加 check、不做枚举**，业务自由定义，
 *   通用层不因业务新增类型而改表；
 * - `payload` 是业务扩展 JSON（href / relatedCode / sender 等），内核不解释；
 *   以 text 列 + drizzle `mode: "json"` 存储，读写自动序列化；
 * - `recipientId` 为收件人标识（当前 starter 约定 = JWT sub = users.email），
 *   只允许服务端从 JWT 取值，绝不接受客户端传参；
 * - `dedupeKey` 为可选幂等键：**同一收件人 + 同一 dedupeKey 只落一条**。
 *   唯一索引对 NULL 的语义：SQLite 视 NULL 互不相等，因此未传 dedupeKey
 *   的通知可重复写入，不会互相冲突。
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipientId: text("recipientId").notNull(),
    /** 不透明业务类型 key（不枚举、不 check） */
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    /** 业务载荷 JSON 对象；nullable + mode json 自动序列化/反序列化 */
    payload: text("payload", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    /** 0 未读 / 1 已读 */
    isRead: integer("isRead").notNull().default(0),
    readTime: text("readTime"),
    createTime: text("createTime").notNull(),
    dedupeKey: text("dedupeKey"),
  },
  (table) => [
    // 列表主查询：按收件人 + (createTime, id) 倒序游标分页。
    // 带上 id 让 ORDER BY createTime DESC, id DESC 直接走索引，避免 TEMP B-TREE。
    index("idx_notification_recipient_create").on(
      table.recipientId,
      table.createTime,
      table.id
    ),
    // 未读数查询：按收件人 + 已读状态过滤
    index("idx_notification_recipient_read").on(
      table.recipientId,
      table.isRead
    ),
    // 幂等去重：同一收件人 + 同一 dedupeKey 唯一（NULL 互不冲突）
    uniqueIndex("uq_notification_recipient_dedupe").on(
      table.recipientId,
      table.dedupeKey
    ),
  ]
)

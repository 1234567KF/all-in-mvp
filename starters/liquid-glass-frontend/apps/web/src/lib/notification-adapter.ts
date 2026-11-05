/**
 * Notification wire → view model 适配器
 *
 * 唯一映射点：后端 wire schema（packages/shared/src/notification.ts 的 Notification）
 * 在这里转换成 NotificationCenter 消费的 NotificationItem，其余层不得再做字段重命名。
 *
 * 字段映射：
 *   id          → id
 *   title       → title
 *   content     → content
 *   createTime  → createdAt（ISO 字符串，UI 用 formatRelativeTime 展示）
 *   isRead(0/1) → read(boolean)
 *   type        → type（业务不透明字符串，查 typeRegistry）
 *   payload.href→ href（路由映射；payload 其余字段原样进 meta）
 *   payload 其余 → meta（供 renderContent / onItemClick 读取业务扩展字段）
 */
import type { Notification } from "shared"

import type { NotificationItem } from "@/components/shared/notification-config"

/**
 * 业务载荷只接受普通对象：数组 / 字符串等脏值直接忽略，避免把垃圾字段塞进 meta。
 */
function toPayloadObject(
  payload: Notification["payload"]
): Record<string, unknown> {
  return typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload)
    ? payload
    : {}
}

/**
 * 只接受站内绝对路径作为跳转目标：
 * - 必须以单个 `/` 开头（排除 `//evil.com` 协议相对地址）；
 * - 排除 `javascript:` / `https:` 等带协议的 URL，避免交给 navigate 时抛错或跳出应用路由。
 * 需要外链的业务请自行在 onItemClick/renderContent 里处理。
 */
function toInternalHref(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined
}

/**
 * 将单条 wire Notification 转成 NotificationItem。
 *
 * `payload` 可能为空（null / undefined）或非对象：此时 href、meta 均缺省。
 * 仅当 `payload.href` 是站内路径时才作为跳转目标，其他值会被忽略。
 */
export function toNotificationItem(wire: Notification): NotificationItem {
  const { href: rawHref, ...restPayload } = toPayloadObject(wire.payload)
  const meta = Object.keys(restPayload).length > 0 ? restPayload : undefined

  return {
    id: wire.id,
    title: wire.title,
    content: wire.content,
    createdAt: wire.createTime,
    read: wire.isRead === 1,
    type: wire.type,
    href: toInternalHref(rawHref),
    meta,
  }
}

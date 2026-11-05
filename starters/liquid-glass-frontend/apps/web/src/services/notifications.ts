/**
 * Notifications service — 封装 /notifications API 调用
 *
 * 契约（wire 类型唯一事实源：packages/shared/src/notification.ts）：
 * - GET    /notifications?cursor&limit&unreadOnly → { items, nextCursor, hasMore }
 * - GET    /notifications/unread-count            → { count }
 * - POST   /notifications/:id/read                → 200
 * - POST   /notifications/read-all                → 200
 * - DELETE /notifications/:id                     → 200
 *
 * 后端响应信封统一为 { success, message, data }，故业务数据取 `res.data.data`。
 * wire Notification 不直接进组件——由 lib/notification-adapter 转成 view model。
 */
import type {
  NotificationListQuery,
  NotificationPage,
  NotificationUnreadCount,
} from "shared"

import { api } from "@/lib/api"

/**
 * 列表查询参数，复用 shared 的 query 契约（字段全部可选，
 * 缺省由后端按 limit=20 / 全部消息处理）。
 */
export type NotificationListParams = Partial<NotificationListQuery>

export const notificationService = {
  /** 游标分页列表；cursor 从上一页响应 nextCursor 原样透传（服务端不透明游标） */
  list: async (
    params: NotificationListParams = {}
  ): Promise<NotificationPage> => {
    const res = await api.get("/notifications", { params })
    return res.data.data
  },

  /** 当前登录用户的未读数（顶栏角标，与列表分页解耦） */
  unreadCount: async (): Promise<NotificationUnreadCount> => {
    const res = await api.get("/notifications/unread-count")
    return res.data.data
  },

  /** 单条标记已读 */
  markRead: async (id: string): Promise<void> => {
    await api.post(`/notifications/${encodeURIComponent(id)}/read`)
  },

  /** 全部标记已读 */
  markAllRead: async (): Promise<void> => {
    await api.post("/notifications/read-all")
  },

  /** 删除单条消息 */
  remove: async (id: string): Promise<void> => {
    await api.delete(`/notifications/${encodeURIComponent(id)}`)
  },
}

/**
 * SSE 流地址 — 与 axios 实例共用同一个 baseURL 环境变量。
 * 订阅端必须用 fetch + ReadableStream（EventSource 无法携带 Authorization header），
 * 所以这里单独暴露 URL 构造，避免在 hook 里重复读 env。
 */
export function getNotificationStreamUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api"
  return `${baseUrl.replace(/\/$/, "")}/notifications/stream`
}

/**
 * 打开消息 SSE 流（网络逻辑留在 service 层，hook 只负责解析与生命周期）。
 *
 * 用 fetch 而不是 EventSource：EventSource 无法自定义 header，而该端点要求
 * `Authorization: Bearer`；同时 fetch 便于用 AbortSignal 统一取消。
 */
export function openNotificationStream(
  token: string,
  signal: AbortSignal
): Promise<Response> {
  return fetch(getNotificationStreamUrl(), {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal,
  })
}

/**
 * Query Key 工厂 — 按域组织，保证 key 结构单一来源
 *
 * 约定：每个领域一个 key 工厂：
 *   <domain>Keys.all / .lists() / .list(params) / .details() / .detail(id)
 * [domain] 为全域失效根；[domain, "list", params] 为列表；
 * [domain, "detail", id] 为详情。新增领域时按此模式扩展。
 */
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...userKeys.lists(), params ?? {}] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string | number) => [...userKeys.details(), id] as const,
  /** 当前登录用户（/users/me） */
  me: () => [...userKeys.all, "me"] as const,
}

export const notificationKeys = {
  /** 消息域失效根：列表 / 未读数一起失效（SSE 事件、写操作后使用） */
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...notificationKeys.lists(), params ?? {}] as const,
  /** 未读数（顶栏角标） */
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
}

// [gen:module:query-keys] 由 bun run gen:module 追加业务域 query key（勿手改本行）
export const logKeys = {
  /** 审计日志域失效根 */
  all: ["logs"] as const,
  lists: () => [...logKeys.all, "list"] as const,
  /** 列表按查询参数分 key：筛选 / 翻页各自独立缓存 */
  list: (params?: Record<string, unknown>) =>
    [...logKeys.lists(), params ?? {}] as const,
}

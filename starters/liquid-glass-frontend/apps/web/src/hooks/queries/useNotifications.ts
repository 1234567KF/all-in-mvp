/**
 * Notification 域 Query hooks — 服务端状态统一由 TanStack Query 管理
 *
 * - useNotifications：游标分页列表；wire Notification 经 lib/notification-adapter
 *   转成 NotificationItem 后才交给 UI（adapter 是唯一字段映射点）。
 * - useUnreadCount：顶栏角标未读数。与列表分开查询，避免列表分页影响全量未读数。
 * - mutations：先乐观更新缓存（点击后角标 / 已读态立即变化），onSettled 再失效
 *   notificationKeys.all，保证与服务端最终一致（SSE、其他端写入都能收敛）。
 */
import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { NotificationPage, NotificationUnreadCount } from "shared"

import type { NotificationItem } from "@/components/shared/notification-config"
import { extractErrorMessage } from "@/lib/errors"
import { toNotificationItem } from "@/lib/notification-adapter"
import { notificationKeys } from "@/lib/query-keys"
import { showError } from "@/lib/toast"
import {
  type NotificationListParams,
  notificationService,
} from "@/services/notifications"

/** adapter 之后的列表页 view model：items 已是 UI 可直接消费的 NotificationItem */
export interface NotificationPageView {
  items: NotificationItem[]
  nextCursor: string | null
  hasMore: boolean
}

export interface UseNotificationsOptions extends NotificationListParams {
  /** 是否发起请求；用于等登录态就绪后再拉取，默认 true */
  enabled?: boolean
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, ...listParams } = options

  return useQuery({
    queryKey: notificationKeys.list(listParams),
    queryFn: async (): Promise<NotificationPageView> => {
      const page: NotificationPage = await notificationService.list(listParams)
      return {
        items: page.items.map(toNotificationItem),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },
    enabled,
    meta: { errorMessage: "加载消息列表失败" },
  })
}

/** 当前用户全量未读数（角标）；select 直接返回 number，组件无需再解包 */
export function useUnreadCount(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationService.unreadCount(),
    select: (data: NotificationUnreadCount) => data.count,
    enabled: options.enabled ?? true,
    meta: { errorMessage: "加载未读消息数失败" },
  })
}

// ─── 缓存乐观更新工具（模块级，避免 hooks 之间重复实现）─────────────────────

interface NotificationMutationContext {
  /** 失效前所有已缓存列表页的快照，用于失败回滚 */
  previousLists: Array<[QueryKey, NotificationPageView | undefined]>
  previousUnreadCount: NotificationUnreadCount | undefined
}

function getListCaches(queryClient: QueryClient) {
  return queryClient.getQueriesData<NotificationPageView>({
    queryKey: notificationKeys.lists(),
  })
}

function restoreListCaches(
  queryClient: QueryClient,
  snapshots: NotificationMutationContext["previousLists"]
) {
  for (const [queryKey, data] of snapshots) {
    queryClient.setQueryData(queryKey, data)
  }
}

function restoreUnreadCount(
  queryClient: QueryClient,
  previous: NotificationUnreadCount | undefined
) {
  if (previous === undefined) return
  queryClient.setQueryData(notificationKeys.unreadCount(), previous)
}

/** 在所有已缓存列表页中查找一条消息（用于判断乐观更新是否要动未读数） */
function findNotification(
  queryClient: QueryClient,
  id: string
): NotificationItem | undefined {
  const lists = getListCaches(queryClient)
  for (const [, page] of lists) {
    const hit = page?.items.find((item) => item.id === id)
    if (hit) return hit
  }
  return undefined
}

function updateListItems(
  queryClient: QueryClient,
  updater: (items: NotificationItem[]) => NotificationItem[]
) {
  queryClient.setQueriesData<NotificationPageView>(
    { queryKey: notificationKeys.lists() },
    (page) => (page ? { ...page, items: updater(page.items) } : page)
  )
}

function adjustUnreadCount(queryClient: QueryClient, delta: number) {
  queryClient.setQueryData<NotificationUnreadCount>(
    notificationKeys.unreadCount(),
    (previous) =>
      previous ? { count: Math.max(0, previous.count + delta) } : previous
  )
}

/** 写操作成功后统一失效消息域（列表 + 未读数），并让服务端数据收敛 */
function invalidateNotifications(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: notificationKeys.all })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * mutation 失败统一提示：全局 mutation onError 只打 console，这里显式 toast，
 * 避免「已读又变回未读 / 删掉的条目又出现」时用户完全无感知。
 */
function notifyMutationError(error: unknown) {
  showError(extractErrorMessage(error) || "操作失败，请稍后重试")
}

/** 标记单条已读：未读数 -1、列表项 read=true，失败回滚 */
export function useMarkRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onMutate: async (id): Promise<NotificationMutationContext> => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      const previousLists = getListCaches(queryClient)
      const previousUnreadCount =
        queryClient.getQueryData<NotificationUnreadCount>(
          notificationKeys.unreadCount()
        )

      const target = findNotification(queryClient, id)
      if (target && !target.read) {
        updateListItems(queryClient, (items) =>
          items.map((item) => (item.id === id ? { ...item, read: true } : item))
        )
        adjustUnreadCount(queryClient, -1)
      }

      return { previousLists, previousUnreadCount }
    },
    onError: (error, _id, context) => {
      if (context) {
        restoreListCaches(queryClient, context.previousLists)
        restoreUnreadCount(queryClient, context.previousUnreadCount)
      }
      notifyMutationError(error)
    },
    onSettled: () => void invalidateNotifications(queryClient),
  })
}

/** 全部标记已读：列表项全部 read=true、未读数清零，失败回滚 */
export function useMarkAllRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: async (): Promise<NotificationMutationContext> => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      const previousLists = getListCaches(queryClient)
      const previousUnreadCount =
        queryClient.getQueryData<NotificationUnreadCount>(
          notificationKeys.unreadCount()
        )

      updateListItems(queryClient, (items) =>
        items.map((item) => (item.read ? item : { ...item, read: true }))
      )
      if (previousUnreadCount !== undefined) {
        queryClient.setQueryData<NotificationUnreadCount>(
          notificationKeys.unreadCount(),
          { count: 0 }
        )
      }

      return { previousLists, previousUnreadCount }
    },
    onError: (error, _variables, context) => {
      if (context) {
        restoreListCaches(queryClient, context.previousLists)
        restoreUnreadCount(queryClient, context.previousUnreadCount)
      }
      notifyMutationError(error)
    },
    onSettled: () => void invalidateNotifications(queryClient),
  })
}

/** 删除单条：从列表缓存移除；未读消息同时把未读数 -1，失败回滚 */
export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => notificationService.remove(id),
    onMutate: async (id): Promise<NotificationMutationContext> => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      const previousLists = getListCaches(queryClient)
      const previousUnreadCount =
        queryClient.getQueryData<NotificationUnreadCount>(
          notificationKeys.unreadCount()
        )

      const target = findNotification(queryClient, id)
      updateListItems(queryClient, (items) =>
        items.filter((item) => item.id !== id)
      )
      if (target && !target.read) adjustUnreadCount(queryClient, -1)

      return { previousLists, previousUnreadCount }
    },
    onError: (error, _id, context) => {
      if (context) {
        restoreListCaches(queryClient, context.previousLists)
        restoreUnreadCount(queryClient, context.previousUnreadCount)
      }
      notifyMutationError(error)
    },
    onSettled: () => void invalidateNotifications(queryClient),
  })
}

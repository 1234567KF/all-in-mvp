/**
 * useNotifications Query hooks 单测（mock service 层）
 * 覆盖：列表拉取 + adapter 映射、参数传递、未读数 select、
 *      三个 mutation 的乐观更新 / 失败回滚 / 失效通知
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Notification, NotificationPage } from "shared"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}))

vi.mock("@/services/notifications", () => ({
  notificationService: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    remove: vi.fn(),
  },
}))

import { notificationKeys } from "@/lib/query-keys"
import { showError } from "@/lib/toast"
import { notificationService } from "@/services/notifications"

import {
  type NotificationPageView,
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "./useNotifications"

const WIRE_UNREAD: Notification = {
  id: "notification-1",
  recipientId: "user-1",
  type: "info",
  title: "未读消息",
  content: "请及时审核",
  payload: { href: "/dashboard" },
  isRead: 0,
  readTime: null,
  createTime: "2026-01-01T00:00:00.000Z",
}

const WIRE_READ: Notification = {
  ...WIRE_UNREAD,
  id: "notification-2",
  title: "已读消息",
  payload: null,
  isRead: 1,
  readTime: "2026-01-01T01:00:00.000Z",
}

const WIRE_PAGE: NotificationPage = {
  items: [WIRE_UNREAD, WIRE_READ],
  nextCursor: "2026-01-01T00:00:00.000Z",
  hasMore: true,
}

/** 供 mutation 乐观更新测试使用的缓存快照（等价于 adapter 映射后的结果） */
const PAGE_VIEW: NotificationPageView = {
  items: [
    {
      id: "notification-1",
      title: "未读消息",
      content: "请及时审核",
      createdAt: "2026-01-01T00:00:00.000Z",
      read: false,
      type: "info",
      href: "/dashboard",
    },
    {
      id: "notification-2",
      title: "已读消息",
      content: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      read: true,
      type: "info",
    },
  ],
  nextCursor: null,
  hasMore: false,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

/** 预置列表 + 未读数缓存，返回读取器；供 mutation 测试断言乐观更新结果 */
function seedCaches(queryClient: QueryClient, unreadCount: number) {
  queryClient.setQueryData(notificationKeys.list(), PAGE_VIEW)
  queryClient.setQueryData(notificationKeys.unreadCount(), {
    count: unreadCount,
  })
}

function readPage(queryClient: QueryClient) {
  return queryClient.getQueryData<NotificationPageView>(notificationKeys.list())
}

function readUnreadCount(queryClient: QueryClient) {
  return queryClient.getQueryData<{ count: number }>(
    notificationKeys.unreadCount()
  )
}

describe("useNotifications hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("useNotifications 拉取列表并经 adapter 映射成 NotificationItem", async () => {
    vi.mocked(notificationService.list).mockResolvedValue(WIRE_PAGE)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useNotifications(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(notificationService.list).toHaveBeenCalledWith({})
    expect(result.current.data).toEqual({
      items: [
        {
          id: "notification-1",
          title: "未读消息",
          content: "请及时审核",
          createdAt: "2026-01-01T00:00:00.000Z",
          read: false,
          type: "info",
          href: "/dashboard",
          meta: undefined,
        },
        {
          id: "notification-2",
          title: "已读消息",
          content: "请及时审核",
          createdAt: "2026-01-01T00:00:00.000Z",
          read: true,
          type: "info",
          href: undefined,
          meta: undefined,
        },
      ],
      nextCursor: "2026-01-01T00:00:00.000Z",
      hasMore: true,
    })
  })

  it("useNotifications 透传分页参数，且 enabled=false 时不请求", async () => {
    vi.mocked(notificationService.list).mockResolvedValue(WIRE_PAGE)

    const { wrapper } = createWrapper()
    const disabled = renderHook(
      () => useNotifications({ enabled: false, limit: 10 }),
      { wrapper }
    )
    // 给 query 一次调度机会，确认 disabled 未触发请求
    await waitFor(() => {
      expect(disabled.result.current.fetchStatus).toBe("idle")
    })
    expect(notificationService.list).not.toHaveBeenCalled()

    const enabled = renderHook(
      () => useNotifications({ limit: 10, unreadOnly: true }),
      { wrapper }
    )
    await waitFor(() => {
      expect(enabled.result.current.isSuccess).toBe(true)
    })
    expect(notificationService.list).toHaveBeenCalledWith({
      limit: 10,
      unreadOnly: true,
    })
  })

  it("useNotifications 服务失败时进入 error 状态", async () => {
    vi.mocked(notificationService.list).mockRejectedValue(
      new Error("network error")
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useNotifications(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it("useUnreadCount 通过 select 直接返回数字", async () => {
    vi.mocked(notificationService.unreadCount).mockResolvedValue({ count: 7 })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUnreadCount(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe(7)
  })

  it("useMarkRead 乐观更新：列表项已读、未读数 -1，并失效消息域", async () => {
    vi.mocked(notificationService.markRead).mockResolvedValue(undefined)

    const { queryClient, wrapper } = createWrapper()
    seedCaches(queryClient, 2)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useMarkRead(), { wrapper })
    await result.current.mutateAsync("notification-1")

    expect(notificationService.markRead).toHaveBeenCalledWith("notification-1")
    expect(readPage(queryClient)?.items[0].read).toBe(true)
    expect(readUnreadCount(queryClient)).toEqual({ count: 1 })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationKeys.all,
    })
  })

  it("useMarkRead 失败时回滚列表与未读数", async () => {
    vi.mocked(notificationService.markRead).mockRejectedValue(
      new Error("标记失败")
    )

    const { queryClient, wrapper } = createWrapper()
    seedCaches(queryClient, 2)

    const { result } = renderHook(() => useMarkRead(), { wrapper })
    await expect(result.current.mutateAsync("notification-1")).rejects.toThrow(
      "标记失败"
    )

    expect(readPage(queryClient)?.items[0].read).toBe(false)
    expect(readUnreadCount(queryClient)).toEqual({ count: 2 })
    // 失败必须给用户反馈，不能只回滚
    expect(showError).toHaveBeenCalledWith("标记失败")
  })

  it("useMarkAllRead 乐观更新：全部已读、未读数清零", async () => {
    vi.mocked(notificationService.markAllRead).mockResolvedValue(undefined)

    const { queryClient, wrapper } = createWrapper()
    seedCaches(queryClient, 2)

    const { result } = renderHook(() => useMarkAllRead(), { wrapper })
    await result.current.mutateAsync()

    expect(notificationService.markAllRead).toHaveBeenCalledTimes(1)
    expect(readPage(queryClient)?.items.every((item) => item.read)).toBe(true)
    expect(readUnreadCount(queryClient)).toEqual({ count: 0 })
  })

  it("useMarkAllRead 失败时回滚并提示用户", async () => {
    vi.mocked(notificationService.markAllRead).mockRejectedValue(
      new Error("全部已读失败")
    )

    const { queryClient, wrapper } = createWrapper()
    seedCaches(queryClient, 2)

    const { result } = renderHook(() => useMarkAllRead(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow("全部已读失败")

    // 回滚到操作前快照：第一条恢复未读、原本已读的保持已读
    expect(readPage(queryClient)?.items[0].read).toBe(false)
    expect(readUnreadCount(queryClient)).toEqual({ count: 2 })
    expect(showError).toHaveBeenCalledWith("全部已读失败")
  })

  it("useDeleteNotification 删除未读消息时同步未读数 -1", async () => {
    vi.mocked(notificationService.remove).mockResolvedValue(undefined)

    const { queryClient, wrapper } = createWrapper()
    seedCaches(queryClient, 2)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useDeleteNotification(), { wrapper })
    await result.current.mutateAsync("notification-1")

    expect(notificationService.remove).toHaveBeenCalledWith("notification-1")
    expect(readPage(queryClient)?.items.map((item) => item.id)).toEqual([
      "notification-2",
    ])
    expect(readUnreadCount(queryClient)).toEqual({ count: 1 })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationKeys.all,
    })
  })

  it("useDeleteNotification 删除已读消息时未读数不变", async () => {
    vi.mocked(notificationService.remove).mockResolvedValue(undefined)

    const { queryClient, wrapper } = createWrapper()
    seedCaches(queryClient, 2)

    const { result } = renderHook(() => useDeleteNotification(), { wrapper })
    await result.current.mutateAsync("notification-2")

    expect(readPage(queryClient)?.items.map((item) => item.id)).toEqual([
      "notification-1",
    ])
    expect(readUnreadCount(queryClient)).toEqual({ count: 2 })
  })
})

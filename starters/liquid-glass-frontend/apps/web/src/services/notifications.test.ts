/**
 * notifications service 测试 — mock @/lib/api，断言 URL / 参数 / 信封解包
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import {
  getNotificationStreamUrl,
  notificationService,
  openNotificationStream,
} from "@/services/notifications"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedDelete = vi.mocked(api.delete)

const PAGE = {
  items: [
    {
      id: "notification-1",
      recipientId: "user-1",
      type: "info",
      title: "标题",
      content: "正文",
      payload: { href: "/dashboard" },
      isRead: 0,
      createTime: "2026-01-01T00:00:00.000Z",
    },
  ],
  nextCursor: "2026-01-01T00:00:00.000Z",
  hasMore: true,
}

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("list 调用 GET /notifications 并解包 data", async () => {
    mockedGet.mockResolvedValueOnce({ data: { success: true, data: PAGE } })

    const params = { limit: 10, unreadOnly: true, cursor: "cursor-1" }
    const result = await notificationService.list(params)

    expect(mockedGet).toHaveBeenCalledWith("/notifications", { params })
    expect(result).toEqual(PAGE)
  })

  it("list 不传参数时使用空参数对象", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: PAGE } })

    await notificationService.list()

    expect(mockedGet).toHaveBeenCalledWith("/notifications", { params: {} })
  })

  it("unreadCount 调用 GET /notifications/unread-count 并解包 data", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { success: true, data: { count: 3 } },
    })

    const result = await notificationService.unreadCount()

    expect(mockedGet).toHaveBeenCalledWith("/notifications/unread-count")
    expect(result).toEqual({ count: 3 })
  })

  it("markRead 调用 POST /notifications/:id/read", async () => {
    mockedPost.mockResolvedValueOnce({ data: { success: true } })

    await notificationService.markRead("notification-1")

    expect(mockedPost).toHaveBeenCalledWith(
      "/notifications/notification-1/read"
    )
  })

  it("markAllRead 调用 POST /notifications/read-all", async () => {
    mockedPost.mockResolvedValueOnce({ data: { success: true } })

    await notificationService.markAllRead()

    expect(mockedPost).toHaveBeenCalledWith("/notifications/read-all")
  })

  it("remove 调用 DELETE /notifications/:id", async () => {
    mockedDelete.mockResolvedValueOnce({ data: { success: true } })

    await notificationService.remove("notification-1")

    expect(mockedDelete).toHaveBeenCalledWith("/notifications/notification-1")
  })

  it("id 做 URL 编码，避免路径注入", async () => {
    mockedDelete.mockResolvedValueOnce({ data: { success: true } })

    await notificationService.remove("a/b")

    expect(mockedDelete).toHaveBeenCalledWith("/notifications/a%2Fb")
  })

  it("getNotificationStreamUrl 默认走 /api 前缀下的流端点", () => {
    expect(getNotificationStreamUrl()).toBe("/api/notifications/stream")
  })
})

describe("openNotificationStream", () => {
  it("用 fetch 携带 Bearer 头打开 SSE 流（EventSource 无法带 header）", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("", { status: 200 }))
    )
    vi.stubGlobal("fetch", fetchMock)
    const controller = new AbortController()

    await openNotificationStream("token-1", controller.signal)

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/stream", {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: "Bearer token-1",
      },
      cache: "no-store",
      signal: controller.signal,
    })
    vi.unstubAllGlobals()
  })
})

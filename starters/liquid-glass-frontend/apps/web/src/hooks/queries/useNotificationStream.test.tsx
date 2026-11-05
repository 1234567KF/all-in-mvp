/**
 * useNotificationStream 单测（vi.stubGlobal("fetch") 模拟 SSE 流）
 * 覆盖：连接成功补拉 + 事件解析失效 + 回调、分帧边界（CRLF / 多行 data /
 *      跨 chunk）、坏事件丢弃不断流、未登录/禁用不连接、卸载 abort 后不再重连、
 *      401 刷新熔断、非 401 4xx 停止重连、流结束后退避重连、token 变更重连。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Notification } from "shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  api: {},
  refreshAccessToken: vi.fn(),
}))

import { refreshAccessToken } from "@/lib/api"
import { notificationKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/stores/auth"

import { useNotificationStream } from "./useNotificationStream"

const WIRE_NOTIFICATION: Notification = {
  id: "notification-1",
  recipientId: "user-1",
  type: "info",
  title: "新的消息",
  content: "请及时查看",
  payload: { href: "/dashboard" },
  isRead: 0,
  readTime: null,
  createTime: "2026-01-01T00:00:00.000Z",
}

const STREAM_URL = "/api/notifications/stream"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

/** 构造一个按 chunk 输出的 SSE Response；流在最后自动 close（触发重连逻辑） */
function createSseResponse(chunks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
    ...init,
  })
}

/** 永不断开的 SSE Response（用于观察 token 变更时的 abort） */
function createOpenSseResponse() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": keep-alive\n\n"))
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  })
}

function notificationEvent(notification: Notification) {
  return `event: notification\ndata: ${JSON.stringify(notification)}\n\n`
}

const fetchMock = vi.fn<typeof fetch>()

describe("useNotificationStream", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
    useAuthStore.setState({
      accessToken: "token-1",
      refreshToken: "refresh-token",
      user: { name: "测试用户", email: "test@example.com" },
    })
  })

  afterEach(() => {
    // 先卸载组件再重置 auth store，避免已挂载组件在 act 外收到 store 更新
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    act(() => {
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
      })
    })
  })

  it("连接成功后补拉一次缓存，收到事件后失效缓存并触发回调", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        // 心跳与未知事件都应忽略
        ": keep-alive\n\n",
        "event: heartbeat\ndata: {}\n\n",
        notificationEvent(WIRE_NOTIFICATION),
      ])
    )
    const onNotification = vi.fn()
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { unmount } = renderHook(
      () => useNotificationStream({ onNotification }),
      { wrapper }
    )

    // 连接成功立即补拉（断线/首屏窗口兜底）
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.all,
      })
    })
    // 事件到达后（150ms 防抖）再失效一次
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2))
    expect(onNotification).toHaveBeenCalledWith(WIRE_NOTIFICATION)
    expect(fetchMock).toHaveBeenCalledWith(
      STREAM_URL,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          Authorization: "Bearer token-1",
        }),
        signal: expect.any(AbortSignal),
      })
    )

    unmount()
  })

  it("正确解析跨 chunk 的 CRLF 帧（JSON 被 chunk 边界切断）", async () => {
    const payload = JSON.stringify(WIRE_NOTIFICATION)
    // 帧被拆成多段、换行使用 CRLF；JSON 在 chunk 边界处被切断但不能引入额外换行
    const chunks = [
      ": connected\r\n\r\n",
      "event: notification\r",
      "\ndata: " + payload.slice(0, 20),
      payload.slice(20, 40),
      payload.slice(40) + "\r\n\r",
      "\n",
    ]
    fetchMock.mockResolvedValue(createSseResponse(chunks))
    const onNotification = vi.fn()
    const { wrapper } = createWrapper()

    const { unmount } = renderHook(
      () => useNotificationStream({ onNotification }),
      { wrapper }
    )

    await waitFor(() => expect(onNotification).toHaveBeenCalledTimes(1))
    expect(onNotification.mock.calls[0][0]).toMatchObject({
      id: WIRE_NOTIFICATION.id,
    })

    unmount()
  })

  it("非法 JSON / 不符合契约的事件被丢弃且不中断订阅", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    fetchMock.mockResolvedValue(
      createSseResponse([
        "event: notification\ndata: {not-json\n\n",
        'event: notification\ndata: {"id":"broken"}\n\n',
        notificationEvent(WIRE_NOTIFICATION),
      ])
    )
    const onNotification = vi.fn()
    const { wrapper } = createWrapper()

    const { unmount } = renderHook(
      () => useNotificationStream({ onNotification }),
      { wrapper }
    )

    await waitFor(() => expect(onNotification).toHaveBeenCalledTimes(1))
    expect(onNotification).toHaveBeenCalledWith(WIRE_NOTIFICATION)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()

    unmount()
  })

  it("无 accessToken 时不发起连接", async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: "refresh-token" })
    const { wrapper } = createWrapper()

    renderHook(() => useNotificationStream(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("enabled=false 时不发起连接", async () => {
    const { wrapper } = createWrapper()

    renderHook(() => useNotificationStream({ enabled: false }), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("卸载后 abort，不再重连", async () => {
    vi.useFakeTimers()
    // 网络失败会打 warn 日志，测试中静音避免干扰输出
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    fetchMock.mockRejectedValue(new TypeError("network error"))
    const { wrapper } = createWrapper()

    const { unmount } = renderHook(() => useNotificationStream(), { wrapper })

    // 让首次 fetch 失败 → catch → 调度 1s 后的重连定时器
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  it("401 刷新后服务端持续 401 时熔断，不会无限 refresh + 重连", async () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    vi.mocked(refreshAccessToken).mockResolvedValue("token-1")
    const { wrapper } = createWrapper()

    const { unmount } = renderHook(() => useNotificationStream(), { wrapper })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    // 1 次初始 + 2 次熔断前重试；refresh 只在前两次 401 后各调用一次
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(refreshAccessToken).toHaveBeenCalledTimes(2)

    unmount()
    warnSpy.mockRestore()
  })

  it("非 401 的 4xx 视为不可恢复，停止重连", async () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))
    const { wrapper } = createWrapper()

    renderHook(() => useNotificationStream(), { wrapper })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    cleanup()
    warnSpy.mockRestore()
  })

  it("流正常结束后按退避重连，并再次补拉缓存", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() =>
      Promise.resolve(createSseResponse([": connected\n\n"]))
    )
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { unmount } = renderHook(() => useNotificationStream(), { wrapper })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2)

    unmount()
  })

  it("token 变更时中止旧连接并用新 token 重连", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(createOpenSseResponse()))
    const { wrapper } = createWrapper()

    const { unmount } = renderHook(() => useNotificationStream(), { wrapper })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const firstSignal = fetchMock.mock.calls[0][1]?.signal
    expect(firstSignal?.aborted).toBe(false)

    act(() => {
      useAuthStore.setState({ accessToken: "token-2" })
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(firstSignal?.aborted).toBe(true)
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer token-2",
    })

    unmount()
  })
})

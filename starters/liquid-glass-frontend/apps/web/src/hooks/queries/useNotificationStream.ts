/**
 * useNotificationStream — 订阅 GET /notifications/stream（SSE over fetch）
 *
 * 为什么不用 EventSource：EventSource 无法携带 Authorization header，而该端点
 * 要求 Bearer 鉴权，因此用 fetch + ReadableStream 手动按 `\n\n` 分帧解析 SSE。
 *
 * 收到 `notification` 事件后选择「失效 notificationKeys.all」而不是「向缓存
 * prepend + 未读数 +1」：列表是游标分页，手工合并要额外处理去重 / hasMore /
 * nextCursor，且未读数的权威值在服务端；失效后由 useNotifications /
 * useUnreadCount 统一重取，实现简单、多端写入也能收敛。
 *
 * 生命周期：
 * - 仅在已登录且内存中有 accessToken 时连接（页面刷新后 accessToken 由 axios
 *   拦截器静默恢复，token 变化会触发 effect 重建连接）。
 * - 每次连接成功（含断线重连、首屏列表与订阅建立之间的窗口）都主动失效一次
 *   消息域缓存：服务端事件是进程内广播、无 Last-Event-ID 重放，断线期间产生的
 *   消息只能靠这次补拉兜底。
 * - 断线（网络错误 / 非 4xx 失败 / 流被服务端或代理关闭）按指数退避重连：
 *   1s 起、每次 ×2、上限 30s；拿到首个数据块后退避重置为 1s（避免 200 后立即
 *   关流时 1s/次空转）。
 * - 401：先尝试刷新一次 token；连续 401 超过 MAX_AUTH_RETRIES 次后熔断停止，
 *   避免服务端持续 401 时形成 refresh + 重连死循环。刷新导致的 token 变化会重建
 *   effect，退避状态存在 ref 里跨 effect 保留，不会立即重连。
 * - 非 401 的 4xx（除 408/429）视为不可恢复，停止重连；5xx/网络错误继续退避。
 * - 组件卸载 / enabled=false / token 变更时 abort 当前连接并清理所有定时器。
 */
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import {
  type Notification,
  NOTIFICATION_STREAM_EVENT,
  NotificationSchema,
} from "shared"

import { refreshAccessToken } from "@/lib/api"
import { notificationKeys } from "@/lib/query-keys"
import { openNotificationStream } from "@/services/notifications"
import { useAuthStore } from "@/stores/auth"

const INITIAL_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000
/** 连续 401 刷新熔断阈值：超过后停止自动重连，等待登录态/人工恢复 */
const MAX_AUTH_RETRIES = 2
/** 单条事件 buffer 上限：服务端不吐空行时防止内存无限增长 */
const MAX_BUFFER_CHARS = 256 * 1024
/** 事件风暴合并窗口：短时间多条通知只触发一次缓存失效 */
const INVALIDATE_DEBOUNCE_MS = 150

interface SseFrame {
  event: string
  data: string
}

/**
 * 解析单个 SSE 帧（调用方已按空行切分）。
 * - 注释行（`: keep-alive` 心跳）忽略；
 * - 无 data 行的帧（如 `event: ping`）返回 null；
 * - 多行 data 按规范用 \n 拼接。
 */
function parseSseFrame(rawFrame: string): SseFrame | null {
  if (!rawFrame.trim()) return null

  let event = "message"
  const dataLines: string[] = []

  for (const line of rawFrame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue

    const colonIndex = line.indexOf(":")
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    let value = colonIndex === -1 ? "" : line.slice(colonIndex + 1)
    if (value.startsWith(" ")) value = value.slice(1)

    if (field === "event") event = value
    else if (field === "data") dataLines.push(value)
  }

  return dataLines.length > 0 ? { event, data: dataLines.join("\n") } : null
}

export interface UseNotificationStreamOptions {
  /** 是否订阅；默认 true，调用方通常无需传（内部已按登录态 gate） */
  enabled?: boolean
  /** 收到合法 notification 事件后的额外回调（如 toast）；缓存失效由 hook 自身处理 */
  onNotification?: (notification: Notification) => void
}

export function useNotificationStream({
  enabled = true,
  onNotification,
}: UseNotificationStreamOptions = {}) {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)

  // 用 ref 持有最新回调，避免调用方传内联函数时每次渲染都重建 SSE 连接
  const onNotificationRef = useRef(onNotification)
  useEffect(() => {
    onNotificationRef.current = onNotification
  }, [onNotification])

  // 跨 effect 保留 401 重试状态：token 刷新会重建 effect，但退避/熔断计数不能丢
  const authGuardRef = useRef({ attempts: 0, nextConnectAt: 0 })

  useEffect(() => {
    if (!enabled || !accessToken) return

    const controller = new AbortController()
    const guard = authGuardRef.current
    let disposed = false
    let retryDelay = INITIAL_RETRY_DELAY_MS
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let guardTimer: ReturnType<typeof setTimeout> | undefined
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined
    let buffer = ""

    /** 事件风暴合并：短时间内多条通知只失效一次缓存 */
    const scheduleInvalidate = () => {
      if (invalidateTimer !== undefined) return
      invalidateTimer = setTimeout(() => {
        invalidateTimer = undefined
        if (!disposed) {
          void queryClient.invalidateQueries({
            queryKey: notificationKeys.all,
          })
        }
      }, INVALIDATE_DEBOUNCE_MS)
    }

    const handleFrame = (frame: SseFrame) => {
      if (frame.event !== NOTIFICATION_STREAM_EVENT) return

      let notification: Notification
      try {
        const parsed = NotificationSchema.safeParse(JSON.parse(frame.data))
        if (!parsed.success) {
          // 兜底：后端契约漂移时丢弃坏事件，不中断整个订阅
          console.warn(
            "[notification-stream] 丢弃不符合 Notification 契约的事件",
            parsed.error
          )
          return
        }
        notification = parsed.data
      } catch (error) {
        console.warn("[notification-stream] 事件 data 不是合法 JSON", error)
        return
      }

      onNotificationRef.current?.(notification)
      scheduleInvalidate()
    }

    const consumeChunk = (chunk: string) => {
      buffer += chunk
      if (buffer.length > MAX_BUFFER_CHARS) {
        buffer = ""
        // 交给外层 catch 走断流 + 退避重连，避免无限内存增长
        throw new Error(
          `SSE 帧缓冲超过 ${MAX_BUFFER_CHARS} 字符，放弃当前连接并重连`
        )
      }
      // SSE 事件以空行分隔；最后一段可能是不完整帧，留在 buffer 等下一个 chunk
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ""
      for (const rawFrame of frames) {
        const frame = parseSseFrame(rawFrame)
        if (frame) handleFrame(frame)
      }
    }

    const scheduleReconnect = () => {
      if (disposed || controller.signal.aborted) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        void connect()
      }, retryDelay)
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
    }

    const connect = async (): Promise<void> => {
      if (disposed || controller.signal.aborted) return
      buffer = ""

      // 401 熔断/退避：token 刷新重建 effect 后也要等够时间，不能立即重连
      const waitMs = Math.max(0, guard.nextConnectAt - Date.now())
      if (waitMs > 0) {
        guardTimer = setTimeout(() => {
          guardTimer = undefined
          void connect()
        }, waitMs)
        return
      }

      let response: Response
      try {
        response = await openNotificationStream(accessToken, controller.signal)
      } catch (error) {
        if (disposed || controller.signal.aborted) return
        console.warn("[notification-stream] 连接失败，准备重连", error)
        scheduleReconnect()
        return
      }

      if (disposed || controller.signal.aborted) return

      if (response.status === 401) {
        await response.body?.cancel().catch(() => {})
        guard.attempts += 1
        if (guard.attempts > MAX_AUTH_RETRIES) {
          console.warn(
            "[notification-stream] 连续 401，停止自动重连（等待登录态恢复）"
          )
          return
        }
        // 刷新前后都留出退避窗口：即使 token 立即变化触发 effect 重建也不会立刻重连
        guard.nextConnectAt = Date.now() + retryDelay
        try {
          await refreshAccessToken()
        } catch {
          // 刷新失败时 refreshAccessToken 已清空 auth，accessToken 变化会让 effect 停止
          return
        }
        if (!disposed && !controller.signal.aborted) scheduleReconnect()
        return
      }

      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {})
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429
        ) {
          console.warn(
            `[notification-stream] HTTP ${response.status}，视为不可恢复错误，停止重连`
          )
          return
        }
        console.warn(
          `[notification-stream] 连接异常（HTTP ${response.status}），准备重连`
        )
        scheduleReconnect()
        return
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (!contentType.includes("text/event-stream")) {
        await response.body.cancel().catch(() => {})
        console.warn(
          "[notification-stream] 响应不是 text/event-stream，准备重连"
        )
        scheduleReconnect()
        return
      }

      // 连接建立成功：重置 401 熔断，并补拉一次消息域缓存（断线期间的消息靠它兜底）
      guard.attempts = 0
      guard.nextConnectAt = 0
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let gotChunk = false

      try {
        while (!disposed) {
          const { done, value } = await reader.read()
          if (done) break
          // 只有真正拿到数据后才重置退避：200 后立即关流不应形成 1s/次空转
          if (!gotChunk) {
            gotChunk = true
            retryDelay = INITIAL_RETRY_DELAY_MS
          }
          consumeChunk(decoder.decode(value, { stream: true }))
        }
        const tail = decoder.decode()
        if (tail) consumeChunk(tail)
      } catch (error) {
        if (disposed || controller.signal.aborted) return
        console.warn("[notification-stream] 流读取中断，准备重连", error)
      }

      if (!disposed && !controller.signal.aborted) scheduleReconnect()
    }

    void connect()

    return () => {
      disposed = true
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
      if (guardTimer !== undefined) clearTimeout(guardTimer)
      if (invalidateTimer !== undefined) clearTimeout(invalidateTimer)
      controller.abort()
    }
  }, [accessToken, enabled, queryClient])
}

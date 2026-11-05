/**
 * Notification API 路由 — 薄 handler（业务无关消息通知内核）
 *
 * 端点：
 * - GET  /notifications             列表（createTime 倒序游标分页，unreadOnly 可选）
 * - GET  /notifications/unread-count 未读数
 * - POST /notifications/:id/read    单条已读（幂等）
 * - POST /notifications/read-all    全部已读（可选 ?type= 过滤）
 * - DELETE /notifications/:id       删除（仅本人）
 * - GET  /notifications/stream      SSE 实时推送（Authorization header 鉴权）
 * - POST /notifications/dev/push    demo-only 造数端点（development/test/DEMO_MODE 之外 404）
 * - POST /notifications/dev/reset   demo-only 重置演示消息（同上）
 *
 * 安全约定：全部路由 authMiddleware + opCtxMiddleware；recipientId 只从 JWT
 * （opCtx.operatorId）取，任何端点都不接受客户端传入的收件人参数。
 *
 * SSE 鉴权说明：EventSource 无法自定义 header，前端需用 fetch + ReadableStream
 * 携带 `Authorization: Bearer <token>` 订阅（不引入 query token，避免 token
 * 泄漏到访问日志/Referer）。
 */
import type { Context } from "hono"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { NOTIFICATION_STREAM_EVENT, NotificationListQuerySchema } from "shared"

import { env } from "../../env.js"
import { authMiddleware } from "../../middleware/auth.js"
import { fail, ok } from "../../response.js"
import { reqLog } from "../../shared/logger.js"
import { notify } from "../../shared/notification.js"
import { notificationBus } from "../../shared/notification-bus.js"
import { opCtxMiddleware } from "../../shared/op-context.js"
import { mapServiceError } from "../../shared/service-error.js"
import { formatZodErrors } from "../../utils/validation.js"
import {
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  resetDemoInbox,
} from "./notification.service.js"

const notificationsRoute = new Hono()

// 所有通知路由：认证 + 操作上下文（recipientId 的唯一来源）
notificationsRoute.use("*", authMiddleware, opCtxMiddleware)

/** SSE 心跳间隔（ms）：需明显小于部署环境的 idle/代理超时（Bun 侧已设 120s） */
export const NOTIFICATION_STREAM_HEARTBEAT_MS = 25_000

/** 从已认证上下文取当前收件人（JWT sub）；禁止客户端传参 */
function recipientIdOf(c: Context): string {
  return c.get("opCtx")!.operatorId
}

/**
 * demo 专用端点开关（fail-closed）：
 * 仅 development / test / 显式 DEMO_MODE 开放；staging、生产或漏设环境一律 404。
 * 真实业务项目不设置 DEMO_MODE，因此这些端点不存在。
 */
function demoRoutesEnabled(): boolean {
  return (
    env.NODE_ENV === "development" || env.NODE_ENV === "test" || env.DEMO_MODE
  )
}

// ─── GET /notifications — 列表（游标分页）──────────────────────────────────────

notificationsRoute.get("/", (c) => {
  const parsed = NotificationListQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      "请求参数校验失败",
      formatZodErrors(parsed)
    )
  }

  try {
    return ok(c, listNotifications(recipientIdOf(c), parsed.data))
  } catch (err) {
    // cursor 非法等业务错误（400）
    return mapServiceError(c, err)
  }
})

// ─── GET /notifications/unread-count — 未读数 ─────────────────────────────────

notificationsRoute.get("/unread-count", (c) => {
  return ok(c, { count: getUnreadCount(recipientIdOf(c)) })
})

// ─── GET /notifications/stream — SSE 实时推送 ─────────────────────────────────

notificationsRoute.get("/stream", (c) => {
  const recipientId = recipientIdOf(c)
  if (!recipientId) {
    return fail(c, 401, "UNAUTHORIZED", "未提供认证 token")
  }

  return streamSSE(c, async (stream) => {
    let cleaned = false
    let resolveClosed: () => void = () => {}
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve
    })

    // 订阅该收件人的实时消息：data 为 shared Notification 契约的 JSON
    const unsubscribe = notificationBus.subscribe(
      recipientId,
      (notification) => {
        void stream
          .writeSSE({
            event: NOTIFICATION_STREAM_EVENT,
            data: JSON.stringify(notification),
          })
          .catch((err: unknown) => {
            reqLog().warn({ err, recipientId }, "notification.sse.write.failed")
          })
      }
    )

    // 心跳注释行：跨代理保活，同时让客户端可观测连接健康度
    const heartbeat = setInterval(() => {
      void stream.write(": ping\n\n")
    }, NOTIFICATION_STREAM_HEARTBEAT_MS)

    // 断开清理：取消 bus 订阅 + 清心跳 + 结束 handler（幂等，onAbort/signal 可能都触发）
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      clearInterval(heartbeat)
      unsubscribe()
      c.req.raw.signal.removeEventListener("abort", cleanup)
      resolveClosed()
    }

    stream.onAbort(cleanup)
    c.req.raw.signal.addEventListener("abort", cleanup)

    // 首个注释行：客户端/测试据此确认订阅已建立
    await stream.write(": connected\n\n")

    // 保持连接直到客户端断开（handler 返回即关闭流）
    await closed
  })
})

// ─── POST /notifications/read-all — 全部已读（可 ?type= 过滤）────────────────
// type 是业务不透明字符串：传了就必须非空白（空串视为参数错误，不能静默退化成
// "全部已读"）；未传才是"全部"。不要 trim 业务 type 本身，否则会篡改匹配值。

notificationsRoute.post("/read-all", (c) => {
  const type = c.req.query("type")
  if (type !== undefined && type.trim() === "") {
    return fail(c, 400, "VALIDATION_ERROR", "type 不能为空字符串")
  }
  try {
    const updated = markAllRead(recipientIdOf(c), type)
    return ok(c, { updated }, "全部标记为已读")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

// ─── POST /notifications/dev/push — dev-only 造数端点 ────────────────────────
// 仅非生产环境：给当前登录用户写一条示例通知，用于手工验证 SSE 实时推送。
// 生产环境显式 404（不注册等于 404，这里显式返回便于自查与测试）。

notificationsRoute.post("/dev/push", (c) => {
  if (!demoRoutesEnabled()) {
    return fail(c, 404, "NOT_FOUND", "Not Found")
  }

  try {
    const notification = notify({
      // recipientId 仍然只从 JWT 取，dev 端点也不接受客户端传收件人
      recipientId: recipientIdOf(c),
      type: "system",
      title: "开发环境测试消息",
      content: `这是一条由 dev 端点生成的调试消息（${new Date().toISOString()}），用于验证 SSE 实时推送。`,
      payload: { href: "/components/notifications" },
    })

    if (!notification) {
      return fail(c, 500, "INTERNAL_ERROR", "消息写入失败")
    }
    return ok(c, { notification }, "已推送")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

// ─── POST /notifications/dev/reset — 恢复演示消息（demo-only）───────────────
// 删除 admin 收件箱里的 seed-notification-* 后按当前时间重种 7 条（4 未读/3 已读），
// 用于测试实例被点完/删完后一键恢复演示态。

notificationsRoute.post("/dev/reset", (c) => {
  if (!demoRoutesEnabled()) {
    return fail(c, 404, "NOT_FOUND", "Not Found")
  }

  try {
    const inserted = resetDemoInbox()
    return ok(c, { inserted }, "演示消息已重置")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

// ─── POST /notifications/:id/read — 单条已读（幂等）──────────────────────────

notificationsRoute.post("/:id/read", (c) => {
  try {
    const notification = markRead(recipientIdOf(c), c.req.param("id"))
    return ok(c, { notification }, "已标记为已读")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

// ─── DELETE /notifications/:id — 删除单条（仅本人）───────────────────────────

notificationsRoute.delete("/:id", (c) => {
  try {
    deleteNotification(recipientIdOf(c), c.req.param("id"))
    return ok(c, { deleted: true }, "已删除")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

export default notificationsRoute

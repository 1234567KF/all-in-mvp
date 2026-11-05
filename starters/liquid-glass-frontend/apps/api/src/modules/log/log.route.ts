/**
 * Log API 路由 — 审计日志只读查询（B4）
 *
 * 端点：
 * - GET /logs  多维筛选 + 服务端分页（module / eventType / result / severity /
 *              keyword / startTime / endTime），固定 createTime 倒序
 *
 * 安全约定：
 * - authMiddleware + requirePermission(AUDIT_VIEW)：审计数据只对持有 audit:view
 *   的角色开放（starter 中 admin 通过 ALL_PERMISSIONS 自动持有）；
 * - 只读：不提供客户端写审计的入口（审计只能由服务端 writeLog 产生，防伪造）。
 */
import { Hono } from "hono"
import { AuditLogQuerySchema, PERMISSIONS } from "shared"

import { authMiddleware } from "../../middleware/auth.js"
import { requirePermission } from "../../middleware/permission.js"
import { fail, ok } from "../../response.js"
import { formatZodErrors } from "../../utils/validation.js"
import { listAuditLogs } from "./log.service.js"

const logsRoute = new Hono()

logsRoute.use("*", authMiddleware)

// ─── GET /logs — 查询审计日志（筛选 + 偏移分页）─────────────────────────────

logsRoute.get("/", requirePermission(PERMISSIONS.AUDIT_VIEW), (c) => {
  const parsed = AuditLogQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      "请求参数校验失败",
      formatZodErrors(parsed)
    )
  }

  return ok(c, listAuditLogs(parsed.data))
})

export default logsRoute

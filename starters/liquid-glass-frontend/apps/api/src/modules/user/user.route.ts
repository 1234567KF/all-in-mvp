/**
 * Users API 路由 — module 模式「活教材」（薄 handler）
 *
 * 骨架约定（回流自 CRM modules/industry）：
 * - 中间件链：authMiddleware → opCtxMiddleware（handler 用 c.get("opCtx")）
 * - 写操作：safeJson 防畸形 body → Zod safeParse → 调 Service → try/catch
 *   + mapServiceError 统一映射领域错误
 * - 路由路径与响应形状与迁移前 routes/users.ts 保持一致
 *   （web 端 useUsers 依赖 GET/PUT /users/me 的 data.user）
 */
import { Hono } from "hono"
import { PERMISSIONS } from "shared"
import { z } from "zod"

import { authMiddleware } from "../../middleware/auth.js"
import { requirePermission } from "../../middleware/permission.js"
import { fail, ok } from "../../response.js"
import { opCtxMiddleware } from "../../shared/op-context.js"
import { mapServiceError } from "../../shared/service-error.js"
import { safeJson } from "../../utils/safe-json.js"
import { formatZodErrors } from "../../utils/validation.js"
import { getMe, updateMe } from "./user.service.js"

const usersRoute = new Hono()

// 所有 /users 路由需要认证 + opCtx
usersRoute.use("*", authMiddleware, opCtxMiddleware)

// ─── GET /users/me — 获取当前用户信息 ─────────────────────────────────────────
// 只读但 Service 会抛 UserNotFoundError（需映射 404），故保留 try/catch

usersRoute.get("/me", (c) => {
  try {
    // JWT sub 即用户邮箱（见 auth.service 签发逻辑）
    const user = getMe(c.get("opCtx")!.operatorId)
    return ok(c, { user })
  } catch (err) {
    return mapServiceError(c, err)
  }
})

// ─── PUT /users/me — 更新当前用户信息（requirePermission 活教材）───────────────
// 路由级权限鉴权示范：拥有 user:edit 权限才放行（admin 自动放行）────────────

// 邮箱变更会导致 JWT sub 失效（token 签发以 email 为 sub），需走独立安全流程，
// 此端点仅允许修改 name。.refine() 防止空 body 透传至 Drizzle 生成无效 SQL。
const UpdateMeSchema = z
  .object({
    name: z.string().min(1).optional(),
  })
  .refine((d) => d.name !== undefined, {
    message: "至少提供一个要更新的字段",
  })

usersRoute.put("/me", requirePermission(PERMISSIONS.USER_EDIT), async (c) => {
  const body = await safeJson(c)
  if (!body) return fail(c, 400, "VALIDATION_ERROR", "请求体必须为有效 JSON")

  const parsed = UpdateMeSchema.safeParse(body)
  if (!parsed.success) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      "请求参数校验失败",
      formatZodErrors(parsed)
    )
  }

  const ctx = c.get("opCtx")!
  try {
    const user = updateMe(ctx, ctx.operatorId, parsed.data)
    return ok(c, { user }, "更新成功")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

export default usersRoute

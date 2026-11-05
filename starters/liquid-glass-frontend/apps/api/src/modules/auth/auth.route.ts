/**
 * Auth API 路由 — module 模式「活教材」（薄 handler）
 *
 * 未认证入口：不挂 authMiddleware，仅挂 opCtxMiddleware 以获得
 * ip/ua/requestId（供登录成功/失败审计使用，operator 字段为空由 Service 覆盖）。
 * 路由路径与响应形状与迁移前 routes/auth.ts 保持一致
 * （B3 起 login 的 user 向后兼容地新增 permissions: string[]）。
 */
import { Hono } from "hono"
import { LoginSchema } from "shared"

import { fail, ok } from "../../response.js"
import { opCtxMiddleware } from "../../shared/op-context.js"
import { mapServiceError } from "../../shared/service-error.js"
import { safeJson } from "../../utils/safe-json.js"
import { auditLoginFailure, login, refreshTokens } from "./auth.service.js"

const auth = new Hono()

auth.use("*", opCtxMiddleware)

// ─── POST /auth/login — 登录 ─────────────────────────────────────────────────

auth.post("/login", async (c) => {
  const body = await safeJson(c)
  const parsed = LoginSchema.safeParse(body ?? {})

  if (!parsed.success) {
    // 保留迁移前的字段级中文提示映射（登录页直接展示 message）
    const fieldMessages: string[] = parsed.error.issues.map((issue) => {
      if (issue.path.includes("email")) return "请输入账号"
      if (issue.path.includes("password")) {
        if (issue.code === "too_small") return "密码至少需要 6 位"
        return "密码格式不正确"
      }
      return issue.message
    })
    const message = fieldMessages[0] || "请求参数校验失败"

    // 登录失败审计（severity warning + result failure）
    const account = typeof body?.email === "string" ? body.email : ""
    auditLoginFailure(c.get("opCtx")!, account, message)

    return fail(c, 400, "VALIDATION_ERROR", message)
  }

  try {
    const result = login(c.get("opCtx")!, parsed.data)
    return ok(c, result, "登录成功")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

// ─── POST /auth/refresh — 刷新 token ─────────────────────────────────────────

auth.post("/refresh", async (c) => {
  const body = await safeJson<{ refreshToken?: unknown }>(c)

  try {
    const tokens = refreshTokens(body?.refreshToken)
    return ok(c, tokens, "刷新成功")
  } catch (err) {
    return mapServiceError(c, err)
  }
})

export default auth

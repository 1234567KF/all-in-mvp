import type { Context, Next } from "hono"

import { fail } from "../response.js"
import type { JwtPayload } from "./auth.js"

/**
 * 从 Hono context 读取已认证的 JWT 用户信息
 * 需在 authMiddleware 之后使用
 */
export function getJwtUser(c: Context): JwtPayload | null {
  try {
    return (c.get("user" as never) as JwtPayload | undefined) ?? null
  } catch {
    return null
  }
}

/**
 * 角色鉴权工厂 — 返回校验指定角色的中间件
 * 用法: requireRole("admin", "sales")
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = getJwtUser(c)
    if (!user || !roles.includes(user.role)) {
      return fail(c, 403, "FORBIDDEN", "无权限操作")
    }
    await next()
  }
}

/** requireAdmin = requireRole("admin") 的快捷方式 */
export function requireAdmin() {
  return requireRole("admin")
}

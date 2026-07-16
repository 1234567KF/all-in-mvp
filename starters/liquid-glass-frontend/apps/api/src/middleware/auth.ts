import type { Context, Next } from "hono"
import jwt from "jsonwebtoken"

import { env } from "../env.js"
import { fail } from "../response.js"

export const JWT_SECRET = env.JWT_SECRET

/** JWT Payload 接口 — 项目按需扩展 */
export interface JwtPayload {
  sub: string
  username: string
  role: string
}

/** 从 Authorization header 提取 Bearer token */
function extractToken(c: Context): string | null {
  const auth = c.req.header("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  return auth.slice(7) || null
}

/** 强制认证中间件 — 无 token 或 token 无效返回 401 */
export async function authMiddleware(c: Context, next: Next) {
  const token = extractToken(c)
  if (!token) {
    return fail(c, 401, "UNAUTHORIZED", "未提供认证 token")
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    c.set("user" as never, decoded)
    await next()
  } catch {
    return fail(c, 401, "UNAUTHORIZED", "token 无效或已过期")
  }
}

/** 可选认证中间件 — 有 token 则解析，无 token 也放行 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = extractToken(c)
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
      c.set("user" as never, decoded)
    } catch {
      // token 无效时不阻断请求，仅跳过
    }
  }
  await next()
}

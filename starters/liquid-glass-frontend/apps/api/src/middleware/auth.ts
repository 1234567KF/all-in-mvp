import type { Context, Next } from "hono"
import jwt from "jsonwebtoken"

import { env } from "../env.js"
import { fail } from "../response.js"
import { reqLog } from "../shared/logger.js"

export const JWT_SECRET = env.JWT_SECRET

/** JWT Payload 接口 — 项目按需扩展 */
export interface JwtPayload {
  sub: string
  username: string
  role: string
  /** 多角色扩展位（可选，项目按需启用） */
  roles?: string[]
  /** 会话 ID（JWT jti）——用于单会话登出与审计定位 */
  sid?: string
  iat?: number
  exp?: number
}

/** 从 Authorization header 提取 Bearer token */
function extractToken(c: Context): string | null {
  const auth = c.req.header("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  return auth.slice(7) || null
}

/**
 * 验证并解析 JWT（显式限定 HS256，防算法混淆攻击）
 * 验证失败抛原始 jwt 错误，由调用方决定处置
 */
function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
  }) as JwtPayload
}

/** 强制认证中间件 — 无 token 或 token 无效返回 401 */
export async function authMiddleware(c: Context, next: Next) {
  const token = extractToken(c)
  if (!token) {
    return fail(c, 401, "UNAUTHORIZED", "未提供认证 token")
  }
  try {
    c.set("user" as never, verifyToken(token))
    await next()
  } catch {
    reqLog().warn(
      { method: c.req.method, path: c.req.path },
      "auth.token.invalid"
    )
    return fail(c, 401, "UNAUTHORIZED", "token 无效或已过期")
  }
}

/** 可选认证中间件 — 有 token 则解析，无 token 也放行 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = extractToken(c)
  if (token) {
    try {
      c.set("user" as never, verifyToken(token))
    } catch {
      // token 无效时不阻断请求，仅跳过
    }
  }
  await next()
}

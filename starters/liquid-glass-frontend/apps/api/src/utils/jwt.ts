import jwt from "jsonwebtoken"

import type { JwtPayload } from "../middleware/auth.js"
import { JWT_SECRET } from "../middleware/auth.js"

/** Access Token 有效期 */
export const JWT_EXPIRES_IN = "24h"

/** Refresh Token 有效期 */
export const REFRESH_EXPIRES_IN = "7d"

/** 签发 Access Token */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/** 签发 Refresh Token（仅含 sub + type） */
export function signRefreshToken(sub: string): string {
  return jwt.sign({ sub, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  })
}

/**
 * Auth 服务层 — 登录/刷新（登录审计「活教材」）
 *
 * 骨架约定（回流自 CRM modules/auth，剥除 CRM 业务：渠道登录/岗位/限流）：
 * - 登录成功/失败均写审计：createAuditor(AUDIT_MODULES.USER) +
 *   AUDIT_EVENT_TYPES.LOGIN，失败传 severity warning + result failure
 * - 登录是未认证入口，OpCtx 的 operator 字段为空（仅 ip/ua/requestId 有值），
 *   审计时用登录目标账号覆盖 operator 字段
 *
 * 密码说明：starter users 表暂无 password 列（schema 归 Wave2 定型，本波不改），
 * 登录仅校验邮箱是否存在于 DB，不做密码校验；引入 password 列后在此接入
 * utils/password.ts 的 verifyPassword。
 */
import { eq } from "drizzle-orm"
import jwt from "jsonwebtoken"
import {
  AUDIT_EVENT_TYPES,
  AUDIT_MODULES,
  AUDIT_RESULT,
  type LoginInput,
} from "shared"

import { getDrizzle } from "../../db.js"
import { users } from "../../db/schema.js"
import { JWT_SECRET } from "../../middleware/auth.js"
import { createAuditor } from "../../shared/audit-log.js"
import type { OpCtx } from "../../shared/op-context.js"
import { ServiceError } from "../../shared/service-error.js"

const audit = createAuditor(AUDIT_MODULES.USER)

// ─── 错误类型 ─────────────────────────────────────────────────────────────────
// code 显式传 "TOKEN_EXPIRED"：保持与迁移前 routes/auth.ts 的响应形状一致

export class LoginFailedError extends ServiceError {
  constructor() {
    super("用户不存在", 401, "LOGIN_FAILED")
    this.name = "LoginFailedError"
  }
}

export class RefreshTokenInvalidError extends ServiceError {
  constructor() {
    super("refreshToken 无效或已过期", 401, "TOKEN_EXPIRED")
    this.name = "RefreshTokenInvalidError"
  }
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

// 种子项目：使用内存 Map 关联 refreshToken 与用户账号（带 TTL 惰性清理）
type SessionUser = { name: string | null; email: string; role: string | null }
const REFRESH_TTL_MS = 7 * 24 * 3600_000 // 7 天
const refreshTokenStore = new Map<
  string,
  { user: SessionUser; expiresAt: number }
>()

function issueTokens(user: SessionUser) {
  // 惰性清理：当条目过多时移除过期条目，避免长期运行内存单调增长
  if (refreshTokenStore.size > 500) {
    const now = Date.now()
    for (const [key, entry] of refreshTokenStore) {
      if (entry.expiresAt < now) refreshTokenStore.delete(key)
    }
  }

  const accessToken = jwt.sign(
    {
      sub: user.email,
      username: user.name ?? user.email,
      role: user.role ?? "user",
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  )
  const refreshToken = `demo-refresh-${Date.now()}`
  refreshTokenStore.set(refreshToken, {
    user,
    expiresAt: Date.now() + REFRESH_TTL_MS,
  })
  return { accessToken, refreshToken }
}

// ─── Service 方法 ─────────────────────────────────────────────────────────────

/** 登录 + 成功审计 */
export function login(ctx: OpCtx, input: LoginInput) {
  // 从数据库中查找用户，不存在则拒绝登录
  const dbUser = getDrizzle()
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .get()

  if (!dbUser) {
    // 登录失败审计
    auditLoginFailure(ctx, input.email, "用户不存在")
    throw new LoginFailedError()
  }

  const user: SessionUser = {
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  }

  // 登录成功审计：登录前无操作人上下文，operator 字段以登录账号覆盖
  audit(
    {
      ...ctx,
      operator: user.name ?? user.email,
      operatorId: String(dbUser.id),
      operatorAccount: user.email,
      operatorRole: user.role ?? "user",
    },
    {
      eventType: AUDIT_EVENT_TYPES.LOGIN,
      target: user.name ?? user.email,
      targetId: String(dbUser.id),
      detail: `账号：${user.email}`,
    }
  )

  return { ...issueTokens(user), user }
}

/** 登录失败审计（route 层参数校验失败时调用） */
export function auditLoginFailure(
  ctx: OpCtx,
  account: string,
  reason: string
): void {
  audit(
    { ...ctx, operator: account, operatorAccount: account },
    {
      eventType: AUDIT_EVENT_TYPES.LOGIN,
      target: account,
      detail: `登录失败：${reason}`,
      severity: "warning",
      result: AUDIT_RESULT.FAILURE,
    }
  )
}

/** 刷新 token（旋转：作废旧 refreshToken，签发新 token 对） */
export function refreshTokens(refreshToken: unknown) {
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new RefreshTokenInvalidError()
  }

  const entry = refreshTokenStore.get(refreshToken)
  refreshTokenStore.delete(refreshToken)

  if (!entry || entry.expiresAt < Date.now()) {
    throw new RefreshTokenInvalidError()
  }

  return issueTokens(entry.user)
}

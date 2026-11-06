/**
 * Auth 服务层 — 登录/刷新/改密（登录审计「活教材」）
 *
 * 骨架约定（回流自 CRM modules/auth，剥除 CRM 业务：渠道登录/岗位/限流）：
 * - 登录成功/失败均写审计：createAuditor(AUDIT_MODULES.USER) +
 *   AUDIT_EVENT_TYPES.LOGIN，失败传 severity warning + result failure
 * - 登录是未认证入口，OpCtx 的 operator 字段为空（仅 ip/ua/requestId 有值），
 *   审计时用登录目标账号覆盖 operator 字段
 *
 * 密码说明：users.password 存 bcrypt 哈希（见 utils/password.ts），校验走
 * verifyPassword；明文只在请求体/环境变量里存在，绝不落库、绝不出 wire
 * （投影剔除见 modules/user/user.service.ts）。种子账号及其口令策略见
 * db/seed-users.ts —— 账号定义只有一份（R010）。
 */
import { eq } from "drizzle-orm"
import jwt from "jsonwebtoken"
import {
  AUDIT_EVENT_TYPES,
  AUDIT_MODULES,
  AUDIT_RESULT,
  type ChangePasswordInput,
  DEFAULT_ROLE,
  type LoginInput,
  permissionsForRole,
} from "shared"

import { getDrizzle } from "../../db.js"
import { users } from "../../db/schema.js"
import { JWT_SECRET } from "../../middleware/auth.js"
import { createAuditor } from "../../shared/audit-log.js"
import type { OpCtx } from "../../shared/op-context.js"
import { ServiceError } from "../../shared/service-error.js"
import { hashPassword, verifyPassword } from "../../utils/password.js"

const audit = createAuditor(AUDIT_MODULES.USER)

// ─── 错误类型 ─────────────────────────────────────────────────────────────────
// code 显式传 "TOKEN_EXPIRED"：保持与迁移前 routes/auth.ts 的响应形状一致
// 「用户不存在」与「密码错误」故意分开：starter 是教学骨架，文案直给便于定位；
// 真实项目若要防账号枚举，应在 route 层合并为同一句话（见 README 权限门控一节）。

export class LoginFailedError extends ServiceError {
  constructor(message = "用户不存在") {
    super(message, 401, "LOGIN_FAILED")
    this.name = "LoginFailedError"
  }
}

export class RefreshTokenInvalidError extends ServiceError {
  constructor() {
    super("refreshToken 无效或已过期", 401, "TOKEN_EXPIRED")
    this.name = "RefreshTokenInvalidError"
  }
}

/** 改密时 JWT 里的账号在库中已不存在（账号被删 / 库被重建） */
export class SessionInvalidError extends ServiceError {
  constructor() {
    super("账号不存在，请重新登录", 401, "UNAUTHORIZED")
    this.name = "SessionInvalidError"
  }
}

/** 原密码校验失败 */
export class OldPasswordIncorrectError extends ServiceError {
  constructor() {
    super("原密码不正确", 400, "OLD_PASSWORD_INCORRECT")
    this.name = "OldPasswordIncorrectError"
  }
}

/**
 * 账号没有密码列（NULL = 走 SSO/企微/飞书等替换式登录，见 db/schema.ts 注释）。
 * 显式拒绝，而不是把 NULL 当空串参与比对。
 */
export class PasswordLoginDisabledError extends ServiceError {
  constructor(message = "该账号未启用密码登录") {
    super(message, 401, "LOGIN_FAILED")
    this.name = "PasswordLoginDisabledError"
  }
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

// 种子项目：使用内存 Map 关联 refreshToken 与用户账号（带 TTL 惰性清理）
// permissions 由 role 在登录时解析一次随 user 下发（前端只消费该数组）
type SessionUser = {
  name: string | null
  email: string
  role: string | null
  permissions: string[]
}
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
      role: user.role ?? DEFAULT_ROLE,
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

/**
 * 登录 + 成功审计（密码严格校验）
 *
 * user.permissions 由 role 解析后随响应下发：前端权限门控（usePermission /
 * PermissionGate / 菜单过滤）只读这个数组，不自行推导角色 → 权限。
 */
export async function login(ctx: OpCtx, input: LoginInput) {
  // 从数据库中查找用户
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

  if (!dbUser.password) {
    auditLoginFailure(ctx, input.email, "该账号未启用密码登录")
    throw new PasswordLoginDisabledError()
  }

  if (!(await verifyPassword(input.password, dbUser.password))) {
    auditLoginFailure(ctx, input.email, "密码错误")
    throw new LoginFailedError("密码错误")
  }

  const user: SessionUser = {
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    permissions: permissionsForRole(dbUser.role),
  }

  // 登录成功审计：登录前无操作人上下文，operator 字段以登录账号覆盖
  audit(
    {
      ...ctx,
      operator: user.name ?? user.email,
      operatorId: String(dbUser.id),
      operatorAccount: user.email,
      operatorRole: user.role ?? DEFAULT_ROLE,
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

/**
 * 刷新 token（旋转：作废旧 refreshToken，签发新 token 对）
 *
 * 只复用登录时的会话快照，不重新查询 DB role / 权限：RBAC 变更需用户重新登录
 * （见 README「权限门控与导航自动派生」的实现边界）。
 */
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

/**
 * 吊销某账号的全部 refreshToken（改密后旧会话不该还能续期）。
 * accessToken 是无状态 JWT，到期自然失效（starter 设 1h，不引入黑名单表）。
 */
function revokeRefreshTokens(email: string): void {
  for (const [token, entry] of refreshTokenStore) {
    if (entry.user.email === email) refreshTokenStore.delete(token)
  }
}

/**
 * 修改密码（已认证入口，ctx 由 authMiddleware + opCtxMiddleware 填好操作人字段）
 *
 * 顺序约定：先校验原密码 → 再落库 → 最后写审计。
 * 校验失败同样写审计（severity warning + result failure）：改密爆破与「本人
 * 忘记原密码」在日志里必须可区分，这是 change_pwd 事件存在的意义。
 */
export async function changePassword(
  ctx: OpCtx,
  email: string,
  input: ChangePasswordInput
): Promise<void> {
  const db = getDrizzle()
  const dbUser = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!dbUser) throw new SessionInvalidError()
  if (!dbUser.password) throw new PasswordLoginDisabledError("该账号未设置密码")

  // 审计里的账号口径与登录一致：operatorAccount 用登录邮箱（JWT username 是显示名）
  const auditCtx = { ...ctx, operatorAccount: email }

  if (!(await verifyPassword(input.oldPassword, dbUser.password))) {
    audit(auditCtx, {
      eventType: AUDIT_EVENT_TYPES.CHANGE_PWD,
      target: dbUser.name ?? dbUser.email,
      targetId: String(dbUser.id),
      detail: "修改密码失败：原密码不正确",
      severity: "warning",
      result: AUDIT_RESULT.FAILURE,
    })
    throw new OldPasswordIncorrectError()
  }

  db.update(users)
    .set({ password: await hashPassword(input.newPassword) })
    .where(eq(users.email, email))
    .run()

  revokeRefreshTokens(email)

  audit(auditCtx, {
    eventType: AUDIT_EVENT_TYPES.CHANGE_PWD,
    target: dbUser.name ?? dbUser.email,
    targetId: String(dbUser.id),
    detail: "密码已更新，该账号全部会话（含当前）的续期凭证已作废",
  })
}

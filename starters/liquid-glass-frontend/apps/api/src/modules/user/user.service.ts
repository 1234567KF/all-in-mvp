/**
 * User 服务层 — module 模式「活教材」
 *
 * 骨架约定（回流自 CRM modules/industry）：
 * - Service 首参统一为 OpCtx（纯数据，不依赖 Hono Context）
 * - 领域错误继承 ServiceError，由 route 层 mapServiceError 统一转 HTTP 响应
 * - 写操作走声明式审计（audited-crud）：表级配置 TableAuditConfig 内联在
 *   Service 顶部，update 用 auditedUpdate 自动 diff（changes key 为中文标签）
 */
import { eq } from "drizzle-orm"
import { AUDIT_MODULES, permissionsForRole, type UpdateMeInput } from "shared"

import { getDrizzle } from "../../db.js"
import { users } from "../../db/schema.js"
import {
  auditedUpdate,
  type TableAuditConfig,
} from "../../shared/audited-crud.js"
import type { OpCtx } from "../../shared/op-context.js"
import { ServiceError } from "../../shared/service-error.js"

// ─── 审计配置（声明式审计教材落点）───────────────────────────────────────────
// fieldLabels 对应 users 表实际列 → 中文标签，auditedUpdate 的 changes diff
// 直接以中文 key 落库，前端展示零转换；snapshotColumns 为 insert/delete
// snapshot 白名单（本模块暂只有 update，保留声明作扩展示例）。
export const USER_AUDIT_CONFIG: TableAuditConfig = {
  module: AUDIT_MODULES.USER,
  fieldLabels: {
    email: "邮箱",
    name: "姓名",
    role: "角色",
  },
  // password 必须显式排除：auditedUpdate 的 changes 直接落 audit_logs.changes，
  // 任何把改密/重置接到审计路径的改动都不应把 bcrypt 哈希写进可通过 GET /logs 读出的字段
  excludeColumns: ["createdAt", "password"],
  snapshotColumns: ["email", "name", "role"],
}

// ─── 错误类型 ─────────────────────────────────────────────────────────────────
// code 显式传 "USER_NOT_FOUND"：保持与迁移前 routes/users.ts 的响应形状一致

export class UserNotFoundError extends ServiceError {
  constructor() {
    super("用户不存在", 404, "USER_NOT_FOUND")
    this.name = "UserNotFoundError"
  }
}

// ─── 类型 ─────────────────────────────────────────────────────────────────────

type UserRow = typeof users.$inferSelect

/**
 * wire 投影后的用户：DB 行去掉 password 哈希（users.password 永不出 wire，
 * 拿到哈希等于离线爆破；见 db/schema.ts 的列注释）。
 */
export type WireUser = Omit<UserRow, "password">

/**
 * DB 行 → wire 用户（唯一允许的出口投影）
 *
 * 约定：新增敏感列时在这里剔除，而不是在 route 里各删各的——route 有多个出口，
 * 漏一个就是静默泄漏。
 */
function toWireUser(row: UserRow): WireUser {
  const { password: _password, ...safe } = row
  return safe
}

/**
 * GET/PUT /users/me 的 wire 形状：DB 行（剔除 password）+ 由 role 解析出的扁平权限码
 *
 * permissions 是前端权限消费的唯一入口（usePermission / PermissionGate /
 * 侧边栏与 ⌘K 菜单过滤），前端不感知 role → 权限的映射规则。
 */
export type MeUser = WireUser & { permissions: string[] }

// UpdateMeInput 统一来自 shared（与 web 共用同一份契约）

// ─── Service 方法 ─────────────────────────────────────────────────────────────

/** 按邮箱（JWT sub）获取当前用户（含 role 解析出的 permissions） */
export function getMe(email: string): MeUser {
  const user = getDrizzle()
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()
  if (!user) throw new UserNotFoundError()
  return {
    ...toWireUser(user),
    permissions: permissionsForRole(user.role),
  }
}

/**
 * 更新当前用户信息（auditedUpdate 活教材）
 *
 * 「先写后审」模式：before 行由本函数已有的 existing 提供（避免重复 SELECT），
 * auditedUpdate 自动对比 before/patch，仅记录实际变更列。
 */
export function updateMe(
  ctx: OpCtx,
  email: string,
  patch: UpdateMeInput
): MeUser {
  const db = getDrizzle()

  const existing = db.select().from(users).where(eq(users.email, email)).get()
  if (!existing) throw new UserNotFoundError()

  const updated = db
    .update(users)
    .set(patch)
    .where(eq(users.email, email))
    .returning()
    .get()!

  auditedUpdate({
    before: existing,
    data: patch,
    ctx,
    config: USER_AUDIT_CONFIG,
    meta: {
      target: existing.name ?? existing.email,
      targetId: String(existing.id),
    },
  })

  return {
    ...toWireUser(updated),
    permissions: permissionsForRole(updated.role),
  }
}

/**
 * Permission 中间件 — 角色/权限鉴权与用户信息获取
 *
 * 权限模型（薄壳版）：JWT role → ROLE_PERMISSIONS 静态映射，零 DB 查询。
 * CRM 完整版差异点：DB 动态授权（roles 表 menus 多岗位并集）/
 * 请求级权限缓存在此扩展。
 */
import type { Context, Next } from "hono"
import type { PermissionCode } from "shared"
import { ROLE_PERMISSIONS } from "shared"

import { fail } from "../response.js"
import { reqLog } from "../shared/logger.js"
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

/**
 * 检查当前用户是否拥有指定权限编码
 * admin 始终放行；其余角色查 ROLE_PERMISSIONS 静态映射（含多角色扩展位 roles），零 DB
 */
export function hasPermission(c: Context, permission: string): boolean {
  const user = getJwtUser(c)
  if (!user) return false

  const roles = [user.role, ...(user.roles ?? [])]
  if (roles.includes("admin")) return true

  // Object.hasOwn：避免角色名为 toString / __proto__ 等原型键时取到函数/对象，
  // 让 `.includes` 抛 TypeError 变成 500；与 shared 的 permissionsForRole 同判据。
  return roles.some(
    (role) =>
      Object.hasOwn(ROLE_PERMISSIONS, role) &&
      ROLE_PERMISSIONS[role].includes(permission)
  )
}

/**
 * 权限鉴权中间件工厂：拥有 codes 中任一权限即放行
 * admin 自动放行（hasPermission 内部处理）；不满足返回 403
 */
export function requirePermission(...codes: PermissionCode[]) {
  return async (c: Context, next: Next) => {
    if (!codes.some((code) => hasPermission(c, code))) {
      const user = getJwtUser(c)
      reqLog().info(
        {
          userId: user?.sub,
          role: user?.role,
          requiredCodes: codes,
          path: c.req.path,
        },
        "authz.permission.denied"
      )
      return fail(c, 403, "FORBIDDEN", "无权限操作")
    }
    await next()
  }
}

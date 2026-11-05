/**
 * usePermission — 前端权限消费原语（Opt-in）
 *
 * 数据源：auth store 中的 `user.permissions: string[]`（登录成功时由
 * POST /auth/login 响应写入；GET /users/me 同样返回该字段但当前不回写 store）。
 * 前端只做「码 → 布尔」判断，不感知角色映射、也不 import ROLE_PERMISSIONS——
 * 权限来源未来从静态映射切到 DB 动态授权时，消费侧零改动。
 *
 * 使用约定：
 *   - 组件内门控用 can()/canAny()；声明式区块用 <PermissionGate>（内部同源判断）
 *   - refresh 只旋转 token、不重新查询角色；RBAC 变更需用户重新登录
 *   - 未登录 / 无 permissions 字段 → 一律 false（fail-closed）
 */
import { useMemo } from "react"
import type { PermissionCode } from "shared"

import { useAuthStore } from "@/stores/auth"

export interface PermissionChecker {
  /** 是否持有指定权限码 */
  can: (code: PermissionCode) => boolean
  /** 是否持有任一权限码；空数组返回 false（fail-closed，调用方不应传空） */
  canAny: (codes: readonly PermissionCode[]) => boolean
}

export function usePermission(): PermissionChecker {
  const permissions = useAuthStore((state) => state.user?.permissions)

  // 权限码集合建一次 Set，按 permissions 引用缓存：登录/登出才重建，
  // 组件重渲染时 can/canAny 保持引用稳定，避免下游 useMemo 失效重算。
  return useMemo(() => {
    const granted = new Set(permissions ?? [])
    return {
      can: (code: PermissionCode) => granted.has(code),
      canAny: (codes: readonly PermissionCode[]) =>
        codes.some((code) => granted.has(code)),
    }
  }, [permissions])
}

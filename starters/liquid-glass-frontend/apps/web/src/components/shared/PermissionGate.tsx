/**
 * PermissionGate — 声明式权限门控包装组件
 *
 * 判断来源与 usePermission 完全一致（登录响应下发的 permissions 数组），
 * 用于按钮 / 操作区 / 区块的按权限显隐，避免在 JSX 里散落 can() 三元。
 *
 * 用法：
 *   <PermissionGate perm={PERMISSIONS.USER_EDIT}>
 *     <Button onClick={handleEdit}>编辑</Button>
 *   </PermissionGate>
 *   // 需要兜底内容（如禁用态提示）时传 fallback
 *   <PermissionGate perm={PERMISSIONS.USER_EDIT} fallback={<ReadonlyHint />}>
 *     <EditForm />
 *   </PermissionGate>
 */
import type { ReactNode } from "react"
import type { PermissionCode } from "shared"

import { usePermission } from "@/hooks/usePermission"

interface PermissionGateProps {
  /** 需要的权限码（PERMISSIONS.* 常量，禁止散落字符串字面量） */
  perm: PermissionCode
  /** 无权限时渲染的兜底内容；缺省不渲染任何节点 */
  fallback?: ReactNode
  children: ReactNode
}

/** 有权限渲染 children，否则渲染 fallback（默认 null） */
function PermissionGate({
  perm,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can } = usePermission()
  return <>{can(perm) ? children : fallback}</>
}

export { PermissionGate, type PermissionGateProps }

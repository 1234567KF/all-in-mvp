/**
 * PermissionGate 单测
 * 覆盖：有权限渲染 children、无权限不渲染、fallback 兜底、未登录不渲染。
 */
import { render, screen } from "@testing-library/react"
import { PERMISSIONS } from "shared"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PermissionGate } from "@/components/shared/PermissionGate"
import { useAuthStore } from "@/stores/auth"

function setUserPermissions(permissions?: string[]) {
  useAuthStore.setState({
    user: { email: "user@example.com", name: "测试用户", permissions },
  })
}

describe("PermissionGate", () => {
  beforeEach(() => {
    // 显式清理 persist 存储 + 重置内存 store，避免测试间会话残留
    sessionStorage.clear()
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it("有权限 → 渲染 children", () => {
    setUserPermissions([PERMISSIONS.USER_EDIT])
    render(
      <PermissionGate perm={PERMISSIONS.USER_EDIT}>
        <button type="button">编辑</button>
      </PermissionGate>
    )
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument()
  })

  it("无权限 → 默认不渲染任何节点", () => {
    setUserPermissions([PERMISSIONS.USER_VIEW])
    render(
      <PermissionGate perm={PERMISSIONS.USER_EDIT}>
        <button type="button">编辑</button>
      </PermissionGate>
    )
    expect(screen.queryByRole("button", { name: "编辑" })).toBeNull()
  })

  it("无权限 + fallback → 渲染兜底内容", () => {
    setUserPermissions([PERMISSIONS.USER_VIEW])
    render(
      <PermissionGate
        perm={PERMISSIONS.USER_EDIT}
        fallback={<span>无编辑权限</span>}
      >
        <button type="button">编辑</button>
      </PermissionGate>
    )
    expect(screen.getByText("无编辑权限")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "编辑" })).toBeNull()
  })

  it("未登录 → 不渲染 children", () => {
    render(
      <PermissionGate perm={PERMISSIONS.USER_VIEW}>
        <span>用户列表</span>
      </PermissionGate>
    )
    expect(screen.queryByText("用户列表")).toBeNull()
  })
})

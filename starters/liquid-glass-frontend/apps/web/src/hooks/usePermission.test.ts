/**
 * usePermission 单测
 *
 * 数据源是 auth store 的 user.permissions（登录响应下发）；覆盖：
 * 登录/未登录、权限码命中、旧会话缺字段、canAny、权限变更重算、引用稳定，
 * 以及 sessionStorage 持久化重新水合的真实边界（旧会话 fail-closed）。
 */
import { act, renderHook } from "@testing-library/react"
import { PERMISSIONS } from "shared"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { usePermission } from "@/hooks/usePermission"
import { useAuthStore } from "@/stores/auth"

const AUTH_STORAGE_KEY = "auth-storage"

/** 直接写入 store 的登录会话用户（hook 的唯一数据源） */
function setUserPermissions(permissions?: string[]) {
  useAuthStore.setState({
    user: { email: "user@example.com", name: "测试用户", permissions },
  })
}

function resetStore() {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
}

/** 模拟浏览器重启后 zustand persist 从 sessionStorage 恢复会话 */
async function rehydratePersistedSession(state: Record<string, unknown>) {
  sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ state, version: 0 })
  )
  await useAuthStore.persist.rehydrate()
}

describe("usePermission", () => {
  beforeEach(() => {
    sessionStorage.clear()
    resetStore()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it("未登录 → can 一律 false", () => {
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(false)
    expect(result.current.canAny([PERMISSIONS.USER_EDIT])).toBe(false)
  })

  it("持有权限码 → can 为 true；未持有 → false", () => {
    setUserPermissions([PERMISSIONS.USER_VIEW])
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_VIEW)).toBe(true)
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(false)
  })

  it("旧会话无 permissions 字段 → 全部 false（fail-closed）", () => {
    setUserPermissions(undefined)
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_VIEW)).toBe(false)
  })

  it("canAny：任一命中为 true；全未命中 / 空数组为 false", () => {
    setUserPermissions([PERMISSIONS.USER_EDIT])
    const { result } = renderHook(() => usePermission())
    expect(
      result.current.canAny([PERMISSIONS.USER_VIEW, PERMISSIONS.USER_EDIT])
    ).toBe(true)
    expect(result.current.canAny([PERMISSIONS.USER_VIEW])).toBe(false)
    expect(result.current.canAny([])).toBe(false)
  })

  it("权限变化后自动重算（store 驱动，无需重登组件）", () => {
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(false)

    act(() => {
      setUserPermissions([PERMISSIONS.USER_EDIT])
    })
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(true)
  })

  it("权限不变时 checker 引用稳定（useMemo，避免下游依赖失效重算）", () => {
    setUserPermissions([PERMISSIONS.USER_VIEW])
    const { result, rerender } = renderHook(() => usePermission())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it("旧会话持久化数据缺 permissions → 重水合后 fail-closed", async () => {
    await rehydratePersistedSession({
      refreshToken: "demo-refresh-token",
      user: { email: "old@example.com", name: "旧会话" },
    })
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(false)
  })

  it("持久化的 permissions 重水合后可正常消费", async () => {
    await rehydratePersistedSession({
      refreshToken: "demo-refresh-token",
      user: {
        email: "user@example.com",
        name: "测试用户",
        permissions: [PERMISSIONS.USER_VIEW],
      },
    })
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_VIEW)).toBe(true)
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(false)
  })

  it("clearAuth（登出）后 → can 恢复 false", () => {
    setUserPermissions([PERMISSIONS.USER_EDIT])
    const { result } = renderHook(() => usePermission())
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(true)

    act(() => {
      useAuthStore.getState().clearAuth()
    })
    expect(result.current.can(PERMISSIONS.USER_EDIT)).toBe(false)
  })
})

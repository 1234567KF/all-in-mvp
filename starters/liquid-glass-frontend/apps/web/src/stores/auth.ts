/**
 * Auth Store — simplified skeleton for liquid-glass-starter seed project.
 *
 * user 使用 shared 的 User wire 契约（含可选 role / permissions）：
 *   - permissions: string[] 由后端按角色解析后随登录响应下发；
 *     前端权限门控（usePermission / PermissionGate / 菜单过滤）只消费该数组，
 *     不在这里做角色 → 权限推导（来源可替换为 DB 动态授权而前端零改动）。
 *   - 会话恢复（refreshToken）只旋转 token，不重新查询用户/角色；权限随 user
 *     一起持久化在 sessionStorage，旧会话缺 permissions 时 fail-closed；
 *     RBAC 变更需用户主动登出再登录（无强制会话失效，旧 accessToken 有效期内
 *     后端仍按旧 JWT role 鉴权）。
 *
 * Token persistence strategy (XSS hardening):
 *   - accessToken: in-memory only (never persisted; lost on page refresh,
 *     silently restored via refreshToken by the api.ts request interceptor)
 *   - refreshToken + user: persisted to sessionStorage (not localStorage)
 */
import type { User } from "shared"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (data: {
    accessToken: string
    refreshToken: string
    user: User
  }) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setAuth: (data) => {
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        })
      },

      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        })
      },

      isAuthenticated: () => get().accessToken !== null,
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => sessionStorage),
      // Only persist refreshToken + user; accessToken stays in memory.
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)

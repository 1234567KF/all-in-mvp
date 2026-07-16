/**
 * Auth Store — simplified skeleton for liquid-glass-starter seed project.
 * Removed: permissions, isSuperAdmin, isAdmin, role business fields.
 *
 * Token persistence strategy (XSS hardening):
 *   - accessToken: in-memory only (never persisted; lost on page refresh,
 *     silently restored via refreshToken by the api.ts request interceptor)
 *   - refreshToken + user: persisted to sessionStorage (not localStorage)
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface User {
  name: string
  email: string
}

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

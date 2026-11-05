/**
 * useUsers Query hooks 单测（mock service 层）
 * 覆盖：当前用户拉取成功/失败、更新 mutation 成功后 invalidate users 域
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/services/users", () => ({
  usersService: {
    me: vi.fn(),
    updateMe: vi.fn(),
  },
}))

import { type User, usersService } from "@/services/users"

import { useCurrentUser, useUpdateCurrentUser } from "./useUsers"

const mockUser: User = {
  id: 1,
  email: "user@example.com",
  name: "测试用户",
  role: "user",
  createdAt: "2026-01-01T00:00:00.000Z",
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

describe("useUsers hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("useCurrentUser 成功时返回当前用户", async () => {
    vi.mocked(usersService.me).mockResolvedValue(mockUser)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual(mockUser)
    expect(usersService.me).toHaveBeenCalledTimes(1)
  })

  it("useCurrentUser 服务失败时进入 error 状态", async () => {
    vi.mocked(usersService.me).mockRejectedValue(new Error("network error"))

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it("useUpdateCurrentUser 成功后 invalidate users 域", async () => {
    vi.mocked(usersService.updateMe).mockResolvedValue({
      ...mockUser,
      name: "新名字",
    })

    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useUpdateCurrentUser(), { wrapper })

    await result.current.mutateAsync({ name: "新名字" })

    expect(usersService.updateMe).toHaveBeenCalledWith({ name: "新名字" })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] })
  })

  it("useUpdateCurrentUser 失败时抛错且不 invalidate", async () => {
    vi.mocked(usersService.updateMe).mockRejectedValue(new Error("更新失败"))

    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useUpdateCurrentUser(), { wrapper })

    await expect(
      result.current.mutateAsync({ name: "新名字" })
    ).rejects.toThrow("更新失败")
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

/**
 * auth service 测试 — 示例模板
 *
 * 演示如何 mock @/lib/api 并断言 service 层调用的 API 路径与入参。
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { changePassword, login } from "@/services/auth"

// mock 整个 api 模块，仅保留需要的 post 方法
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}))

const mockedPost = vi.mocked(api.post)

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("login 调用正确的 API 路径并返回数据", async () => {
    const responseData = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: { name: "Admin", email: "admin@example.com" },
    }
    mockedPost.mockResolvedValueOnce({ data: { data: responseData } })

    const input = { email: "admin@example.com", password: "secret" }
    const result = await login(input)

    expect(mockedPost).toHaveBeenCalledWith("/auth/login", input)
    expect(result).toEqual(responseData)
  })

  it("changePassword 调用正确的 API 路径", async () => {
    mockedPost.mockResolvedValueOnce({ data: {} })

    const input = { oldPassword: "old", newPassword: "new" }
    await changePassword(input)

    expect(mockedPost).toHaveBeenCalledWith("/api/auth/change-password", input)
  })
})

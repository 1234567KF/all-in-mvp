/**
 * queryClient 全局行为单测：
 * 1) 登出时必须清空缓存（同一 tab 内 A 退出、B 登录，若不清缓存，B 首屏会先看到 A 的列表与角标）。
 * 2) mutation 失败默认 toast，且 meta.silentError 可抑制（避免提交失败静默无反馈 / 重复 toast）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}))

import { queryClient } from "@/lib/query"
import { showError } from "@/lib/toast"
import { useAuthStore } from "@/stores/auth"

describe("queryClient 登出清理", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: "token-a",
      refreshToken: "refresh-a",
      user: { name: "用户 A", email: "a@example.com" },
    })
  })

  afterEach(() => {
    queryClient.clear()
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  it("clearAuth 后查询缓存被清空", () => {
    queryClient.setQueryData(["notifications", "unread-count"], { count: 3 })
    expect(queryClient.getQueryData(["notifications", "unread-count"])).toEqual(
      {
        count: 3,
      }
    )

    useAuthStore.getState().clearAuth()

    expect(
      queryClient.getQueryData(["notifications", "unread-count"])
    ).toBeUndefined()
  })

  it("token 刷新（accessToken 变化但未登出）不清空缓存", () => {
    queryClient.setQueryData(["notifications", "unread-count"], { count: 3 })

    useAuthStore.setState({ accessToken: "token-b" })

    expect(queryClient.getQueryData(["notifications", "unread-count"])).toEqual(
      {
        count: 3,
      }
    )
  })
})

describe("mutation 默认错误处理", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认处理内部会 console.error，测试里静音避免噪音（用例中仍断言它被调用）
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    queryClient.getMutationCache().clear()
    consoleErrorSpy.mockRestore()
  })

  /**
   * 走真实链路验证：MutationCache.build 会用 queryClient.defaultMutationOptions
   * 合并 defaultOptions.mutations（含默认 onError），execute 后即可观察默认行为。
   */
  function buildFailingMutation(
    error: unknown,
    meta?: Record<string, unknown>
  ) {
    return queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(error),
      ...(meta ? { meta } : {}),
    })
  }

  it("无 meta 时失败弹出服务端 message（优先于 Error.message）", async () => {
    const error = Object.assign(
      new Error("Request failed with status code 400"),
      { response: { data: { message: "名称已被使用，请更换名称后重试" } } }
    )
    const mutation = buildFailingMutation(error)

    await expect(mutation.execute(undefined)).rejects.toBe(error)

    expect(showError).toHaveBeenCalledTimes(1)
    expect(showError).toHaveBeenCalledWith("名称已被使用，请更换名称后重试")
    // UI 已提示的同时仍保留 console.error，便于排查完整错误对象
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("服务端无 message 时回退到 Error.message", async () => {
    const error = new Error("网络超时")
    const mutation = buildFailingMutation(error)

    await expect(mutation.execute(undefined)).rejects.toThrow("网络超时")

    expect(showError).toHaveBeenCalledTimes(1)
    expect(showError).toHaveBeenCalledWith("网络超时")
  })

  it("meta.silentError=true 时不弹 toast，但仍打 console.error", async () => {
    const mutation = buildFailingMutation(new Error("静默失败"), {
      silentError: true,
    })

    await expect(mutation.execute(undefined)).rejects.toThrow("静默失败")

    expect(showError).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("mutation 自带 onError 时默认兜底不触发（避免重复 toast）", async () => {
    const customOnError = vi.fn()
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(new Error("业务错误")),
      onError: customOnError,
    })

    await expect(mutation.execute(undefined)).rejects.toThrow("业务错误")

    expect(customOnError).toHaveBeenCalledTimes(1)
    expect(showError).not.toHaveBeenCalled()
  })
})

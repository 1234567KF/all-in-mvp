/**
 * queryClient 全局行为单测：登出时必须清空缓存。
 *
 * 场景：同一 tab 内 A 退出、B 登录，若不清缓存，B 首屏会先看到 A 的列表与角标。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { queryClient } from "@/lib/query"
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

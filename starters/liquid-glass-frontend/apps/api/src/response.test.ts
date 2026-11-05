import { describe, expect, it } from "bun:test"

import { fail, ok } from "./response.js"

// Smoke test 兜底：保证模板项目在 `bun test src/` 下至少有 1 个测试文件命中，
// 避免 CI test:api job 因 "0 tests matched" 报错。
// 项目自行引入业务后应删除或替换本文件。

type MockCtx = {
  json: (payload: unknown) => unknown
  get: (key: string) => unknown
}
type ApiResponse = {
  success: boolean
  data?: unknown
  code?: string
  message?: string
  requestId?: string
}

/** 模拟 Hono Context：json 直接回显 payload，get 返回注入的 requestId */
function mockCtx(requestId?: string): MockCtx {
  return {
    json: (payload: unknown) => payload,
    get: (key: string) => (key === "requestId" ? requestId : undefined),
  }
}

describe("response smoke", () => {
  it("ok() returns success payload", () => {
    const c = mockCtx()
    const res = ok(c as never, { hello: "world" }) as unknown as ApiResponse
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ hello: "world" })
  })

  it("ok() carries requestId from context", () => {
    const c = mockCtx("req-ok-123")
    const res = ok(c as never, { hello: "world" }) as unknown as ApiResponse
    expect(res.requestId).toBe("req-ok-123")
  })

  it("fail() returns error payload with default code", () => {
    const c = mockCtx()
    const res = fail(c as never, 400) as unknown as ApiResponse
    expect(res.success).toBe(false)
    expect(res.code).toBe("BAD_REQUEST")
  })

  it("fail() carries message when provided", () => {
    const c = mockCtx()
    const res = fail(
      c as never,
      400,
      "BAD_REQUEST",
      "boom"
    ) as unknown as ApiResponse
    expect(res.message).toBe("boom")
  })

  it("fail() carries requestId from context", () => {
    const c = mockCtx("req-fail-456")
    const res = fail(c as never, 500) as unknown as ApiResponse
    expect(res.requestId).toBe("req-fail-456")
  })
})

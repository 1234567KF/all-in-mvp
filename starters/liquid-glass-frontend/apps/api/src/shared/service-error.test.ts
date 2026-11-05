/**
 * ServiceError / mapServiceError 单元测试 — 领域错误按自带 status/code 映射为 HTTP 响应
 * 运行方式：bun test src/shared/service-error.test.ts
 */
import { describe, expect, it } from "bun:test"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  ConflictError,
  ForbiddenError,
  mapServiceError,
  NotFoundError,
  ServiceError,
  ValidationError,
} from "./service-error.js"

// 构造一个最小 Hono context 用于测试
function makeCtx() {
  const app = new Hono()
  let ctx: Context | undefined
  app.get("/_test", (c) => {
    ctx = c
    return c.text("ok")
  })
  // 同步触发（Hono fetch 是同步的）
  app.fetch(new Request("http://localhost/_test"))
  return ctx!
}

describe("mapServiceError", () => {
  it("ServiceError 按自带 status 映射（404/403/409/400/401）", async () => {
    const ctx = makeCtx()
    for (const status of [404, 403, 409, 400, 401] as const) {
      const res = mapServiceError(ctx, new ServiceError("领域错误", status))
      expect(res.status).toBe(status)
      const body = await res.json()
      expect(body.message).toBe("领域错误")
    }
  })

  it("内置子类携带对应 status 与 code", async () => {
    const ctx = makeCtx()
    const cases: [ServiceError, number, string][] = [
      [new NotFoundError(), 404, "NOT_FOUND"],
      [new ConflictError(), 409, "CONFLICT"],
      [new ForbiddenError(), 403, "FORBIDDEN"],
      [new ValidationError(), 400, "VALIDATION"],
    ]
    for (const [err, status, code] of cases) {
      const res = mapServiceError(ctx, err)
      expect(res.status).toBe(status)
      const body = await res.json()
      expect(body.code).toBe(code)
    }
  })

  it("ServiceError 子类继承 status 与 name", async () => {
    const ctx = makeCtx()
    class FooNotFoundError extends NotFoundError {
      constructor(message = "Foo 不存在") {
        super(message)
        this.name = "FooNotFoundError"
      }
    }
    const err = new FooNotFoundError()
    expect(err.name).toBe("FooNotFoundError")
    const res = mapServiceError(ctx, err)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toBe("Foo 不存在")
  })

  it("无 code 的 ServiceError 回退 fail() 的默认 code", async () => {
    const ctx = makeCtx()
    const res = mapServiceError(ctx, new ServiceError("冲突", 409))
    const body = await res.json()
    expect(body.code).toBe("CONFLICT")
  })

  it("500 — 非 ServiceError 走兜底，不回显内部信息", async () => {
    const ctx = makeCtx()
    const res = mapServiceError(
      ctx,
      new Error("SQLITE_BUSY: database is locked")
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toBe("服务器内部错误")
    expect(body.code).toBe("INTERNAL_ERROR")
    expect(body.message).not.toContain("SQLITE_BUSY")
  })

  it("conflictMapper 优先拦截", async () => {
    const ctx = makeCtx()
    const res = mapServiceError(
      ctx,
      new ServiceError("名称已存在", 409),
      () => "自定义冲突文案"
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.message).toBe("自定义冲突文案")
    expect(body.code).toBe("CONFLICT")
  })

  it("conflictMapper 返回 null 时继续按 status 映射", () => {
    const ctx = makeCtx()
    const res = mapServiceError(
      ctx,
      new ServiceError("不存在", 404),
      () => null
    )
    expect(res.status).toBe(404)
  })
})

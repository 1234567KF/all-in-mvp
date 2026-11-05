/**
 * op-context 操作上下文测试
 * 运行方式：bun test src/shared/op-context.test.ts
 */
import { describe, expect, it } from "bun:test"
import { Hono } from "hono"

import { type OpCtx, opCtxMiddleware, toOpCtx } from "./op-context.js"

// ─── 辅助：构造带 JWT 变量的 Hono Context ─────────────────────────────────────

function makeContext(opts: {
  sub?: string
  username?: string
  role?: string
  sid?: string
  requestId?: string
  userAgent?: string
  ip?: string
}) {
  const app = new Hono()
  let captured: OpCtx | undefined

  app.use("*", async (c, next) => {
    // 模拟 authMiddleware 注入的 JWT 变量（变量名为 "user"）
    if (opts.sub) {
      c.set("user", {
        sub: opts.sub,
        username: opts.username ?? "testuser",
        role: opts.role ?? "admin",
        sid: opts.sid,
      })
    }
    if (opts.requestId) {
      c.set("requestId", opts.requestId)
    }
    await next()
  })

  app.get("/test", (c) => {
    captured = toOpCtx(c)
    return c.text("ok")
  })

  const headers: Record<string, string> = {}
  if (opts.userAgent) headers["user-agent"] = opts.userAgent
  if (opts.ip) headers["x-forwarded-for"] = opts.ip

  app.fetch(new Request("http://localhost/test", { headers }))

  return captured!
}

// ─── toOpCtx ──────────────────────────────────────────────────────────────────

describe("toOpCtx", () => {
  it("完整 JWT 用户信息提取（零 DB 查询，全部直取 payload/headers）", () => {
    const ctx = makeContext({
      sub: "u-123",
      username: "alice",
      role: "user",
      sid: "session-1",
      requestId: "req-abc",
      userAgent: "Mozilla/5.0",
      ip: "192.168.1.100",
    })

    expect(ctx.operatorId).toBe("u-123")
    expect(ctx.operator).toBe("alice") // 直取 username
    expect(ctx.operatorAccount).toBe("alice")
    expect(ctx.operatorRole).toBe("user") // 直取 JWT role
    expect(ctx.ipAddress).toBe("192.168.1.100")
    expect(ctx.userAgent).toBe("Mozilla/5.0")
    expect(ctx.requestId).toBe("req-abc")
    expect(ctx.sid).toBe("session-1")
  })

  it("未认证时所有字段为空/默认值", () => {
    const ctx = makeContext({})

    expect(ctx.operatorId).toBe("")
    expect(ctx.operator).toBe("")
    expect(ctx.operatorAccount).toBe("")
    expect(ctx.operatorRole).toBe("")
    expect(ctx.sid).toBeUndefined()
  })

  it("无 requestId / user-agent 时回退空字符串", () => {
    const ctx = makeContext({ sub: "u-1", username: "bob", role: "admin" })

    expect(ctx.requestId).toBe("")
    expect(ctx.userAgent).toBe("")
  })
})

// ─── opCtxMiddleware ──────────────────────────────────────────────────────────

describe("opCtxMiddleware", () => {
  it("中间件注入 opCtx 到 context", async () => {
    const app = new Hono()
    let capturedCtx: OpCtx | undefined

    app.use("*", async (c, next) => {
      c.set("user", {
        sub: "u-mw",
        username: "mwuser",
        role: "admin",
      })
      await next()
    })

    app.use("*", opCtxMiddleware)

    app.get("/test", (c) => {
      capturedCtx = c.get("opCtx")
      return c.text("ok")
    })

    await app.fetch(new Request("http://localhost/test"))

    expect(capturedCtx).toBeDefined()
    expect(capturedCtx!.operatorId).toBe("u-mw")
    expect(capturedCtx!.operatorAccount).toBe("mwuser")
    expect(capturedCtx!.operatorRole).toBe("admin")
  })
})

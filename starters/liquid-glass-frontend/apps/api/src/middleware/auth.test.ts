/**
 * Auth 中间件单元测试
 *
 * 覆盖 extractToken（间接）、authMiddleware、optionalAuthMiddleware。
 * 使用真实 jsonwebtoken 签发 token（开发默认 JWT_SECRET），不依赖 mock preload。
 *
 * 运行方式：bun test src/middleware/auth.test.ts
 */
import { describe, expect, it } from "bun:test"
import type { MiddlewareHandler } from "hono"
import { Hono } from "hono"
import jwt from "jsonwebtoken"

import type { JwtPayload } from "./auth.js"
import { authMiddleware, JWT_SECRET, optionalAuthMiddleware } from "./auth.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(payload: Partial<JwtPayload>) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" })
}

const validToken = signToken({ sub: "1", username: "alice", role: "admin" })

function createApp(middleware: MiddlewareHandler) {
  const app = new Hono()
  app.use("*", middleware)
  app.get("/test", (c) => {
    const user = c.get("user" as never) as JwtPayload | undefined
    return c.json({ ok: true, user })
  })
  return app
}

async function request(
  app: Hono,
  path: string,
  headers?: Record<string, string>
) {
  const res = await app.request(path, { headers })
  const body = await res.json()
  return { status: res.status, body }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("extractToken（通过 authMiddleware 间接测试）", () => {
  const app = createApp(authMiddleware)

  it("无 Authorization header → 401（统一 fail 响应：含 UNAUTHORIZED code）", async () => {
    const { status, body } = await request(app, "/test")
    expect(status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.code).toBe("UNAUTHORIZED")
    expect(body.message).toBe("未提供认证 token")
  })

  it("非 Bearer 格式 → 401", async () => {
    const { status } = await request(app, "/test", {
      Authorization: "Basic abc123",
    })
    expect(status).toBe(401)
  })

  it("空 Bearer → 401", async () => {
    const { status } = await request(app, "/test", { Authorization: "Bearer " })
    // "Bearer " slice(7) → ""，extractToken 返回 null → 401
    expect(status).toBe(401)
  })
})

describe("authMiddleware", () => {
  const app = createApp(authMiddleware)

  it("无效 token → 401（统一 fail 响应：含 UNAUTHORIZED code）", async () => {
    const { status, body } = await request(app, "/test", {
      Authorization: "Bearer bad-token",
    })
    expect(status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.code).toBe("UNAUTHORIZED")
    expect(body.message).toContain("token 无效或已过期")
  })

  it("错误密钥签发的 token → 401", async () => {
    const forged = jwt.sign({ sub: "1", role: "admin" }, "wrong-secret", {
      algorithm: "HS256",
    })
    const { status } = await request(app, "/test", {
      Authorization: `Bearer ${forged}`,
    })
    expect(status).toBe(401)
  })

  it("有效 token → 200，context 中写入 user", async () => {
    const { status, body } = await request(app, "/test", {
      Authorization: `Bearer ${validToken}`,
    })
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.user).toBeDefined()
    expect(body.user.sub).toBe("1")
    expect(body.user.role).toBe("admin")
  })

  it("payload 可选字段（sid / roles）原样透传", async () => {
    const token = signToken({
      sub: "2",
      username: "bob",
      role: "member",
      roles: ["member", "auditor"],
      sid: "session-abc",
    })
    const { status, body } = await request(app, "/test", {
      Authorization: `Bearer ${token}`,
    })
    expect(status).toBe(200)
    expect(body.user.sid).toBe("session-abc")
    expect(body.user.roles).toEqual(["member", "auditor"])
  })
})

describe("requestId 不被 authMiddleware 覆盖", () => {
  it("全局注入的 requestId 在 auth 后保持不变", async () => {
    const app = new Hono()
    // 模拟 index.ts 全局 requestId 注入
    app.use("*", async (c, next) => {
      c.set("requestId", "global-req-id-123")
      await next()
    })
    app.use("*", authMiddleware)
    app.get("/test", (c) => c.json({ requestId: c.get("requestId") }))

    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const body = await res.json()
    expect(body.requestId).toBe("global-req-id-123")
  })

  it("401 响应经 fail 助手透出 requestId", async () => {
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("requestId", "req-401-trace")
      await next()
    })
    app.use("*", authMiddleware)
    app.get("/test", (c) => c.json({ ok: true }))

    const res = await app.request("/test")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.requestId).toBe("req-401-trace")
    expect(body.code).toBe("UNAUTHORIZED")
  })
})

describe("optionalAuthMiddleware", () => {
  const app = createApp(optionalAuthMiddleware)

  it("无 token → 放行，无 user", async () => {
    const { status, body } = await request(app, "/test")
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.user).toBeUndefined()
  })

  it("无效 token → 放行，无 user", async () => {
    const { status, body } = await request(app, "/test", {
      Authorization: "Bearer bad-token",
    })
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.user).toBeUndefined()
  })

  it("有效 token → 写入 user", async () => {
    const { status, body } = await request(app, "/test", {
      Authorization: `Bearer ${validToken}`,
    })
    expect(status).toBe(200)
    expect(body.user).toBeDefined()
    expect(body.user.sub).toBe("1")
  })
})

/**
 * Permission 中间件单元测试
 *
 * 覆盖 getJwtUser、requireRole、requireAdmin、hasPermission、requirePermission。
 * 权限模型为 JWT role → ROLE_PERMISSIONS 静态映射，零 DB，无需 mock 数据库。
 *
 * 运行方式：bun test src/middleware/permission.test.ts
 */
import { describe, expect, it } from "bun:test"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"
import { PERMISSIONS } from "shared"

import type { JwtPayload } from "./auth.js"
import {
  getJwtUser,
  hasPermission,
  requireAdmin,
  requirePermission,
  requireRole,
} from "./permission.js"

type TestUser = Pick<JwtPayload, "sub" | "username" | "role"> &
  Partial<Pick<JwtPayload, "roles">>

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 构造一个带 user 的 Hono context */
function createCtx(user?: TestUser) {
  const app = new Hono()
  let captured: unknown = null
  app.get("/probe", (c) => {
    if (user) c.set("user", user as JwtPayload)
    captured = c
    return c.json({ ok: true })
  })
  // 同步执行请求以获取 context
  app.request("/probe")
  return captured as Context
}

/** 测试中间件是否放行 */
async function runMiddleware(
  mwFactory: () => MiddlewareHandler,
  user?: TestUser
) {
  const app = new Hono()
  // 通过前置中间件注入 user 到 context
  app.use("*", async (c, next) => {
    if (user) c.set("user", user as JwtPayload)
    await next()
  })
  app.use("*", mwFactory())
  app.get("/test", (c) => {
    return c.json({ ok: true })
  })
  const res = await app.request("/test")
  const body = await res.json()
  return { status: res.status, body }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getJwtUser", () => {
  it("context 有 user → 返回 user 对象", () => {
    const c = createCtx({ sub: "1", username: "admin", role: "admin" })
    const user = getJwtUser(c)
    expect(user).not.toBeNull()
    expect(user!.sub).toBe("1")
    expect(user!.role).toBe("admin")
  })

  it("context 无 user → 返回 null", () => {
    const c = createCtx()
    const user = getJwtUser(c)
    expect(user).toBeNull()
  })
})

describe("requireRole", () => {
  it("角色匹配 → 放行", async () => {
    const { status, body } = await runMiddleware(
      () => requireRole("admin", "user"),
      { sub: "1", username: "admin", role: "admin" }
    )
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it("角色不匹配 → 403", async () => {
    const { status, body } = await runMiddleware(() => requireRole("admin"), {
      sub: "2",
      username: "bob",
      role: "user",
    })
    expect(status).toBe(403)
    expect(body.success).toBe(false)
  })

  it("无用户 → 403", async () => {
    const { status } = await runMiddleware(() => requireRole("admin"))
    expect(status).toBe(403)
  })
})

describe("requireAdmin", () => {
  it("admin → 放行", async () => {
    const { status } = await runMiddleware(() => requireAdmin(), {
      sub: "1",
      username: "admin",
      role: "admin",
    })
    expect(status).toBe(200)
  })

  it("普通用户 → 403", async () => {
    const { status } = await runMiddleware(() => requireAdmin(), {
      sub: "2",
      username: "bob",
      role: "user",
    })
    expect(status).toBe(403)
  })
})

// ── hasPermission ─────────────────────────────────────────────────────────────

describe("hasPermission", () => {
  it("admin 角色始终返回 true", () => {
    const c = createCtx({ sub: "1", username: "admin", role: "admin" })
    expect(hasPermission(c, PERMISSIONS.USER_VIEW)).toBe(true)
    expect(hasPermission(c, "anything")).toBe(true)
  })

  it("无用户 → false", () => {
    const c = createCtx()
    expect(hasPermission(c, PERMISSIONS.USER_VIEW)).toBe(false)
  })

  it("角色静态映射命中 → true", () => {
    // ROLE_PERMISSIONS.user 含 user:view
    const c = createCtx({ sub: "2", username: "bob", role: "user" })
    expect(hasPermission(c, PERMISSIONS.USER_VIEW)).toBe(true)
  })

  it("角色静态映射未命中 → false", () => {
    // "viewer" 未在 ROLE_PERMISSIONS 中登记，任何权限均不命中
    const c = createCtx({ sub: "2", username: "bob", role: "viewer" })
    expect(hasPermission(c, PERMISSIONS.USER_EDIT)).toBe(false)
  })

  it("未登记角色 → false", () => {
    const c = createCtx({ sub: "3", username: "eve", role: "ghost" })
    expect(hasPermission(c, PERMISSIONS.USER_VIEW)).toBe(false)
  })

  it("多角色扩展位 roles 命中任一即 true", () => {
    const c = createCtx({
      sub: "4",
      username: "carol",
      role: "ghost",
      roles: ["user"],
    })
    expect(hasPermission(c, PERMISSIONS.USER_VIEW)).toBe(true)
  })

  it("roles 含 admin → 全量放行", () => {
    const c = createCtx({
      sub: "5",
      username: "dave",
      role: "user",
      roles: ["admin"],
    })
    expect(hasPermission(c, PERMISSIONS.USER_EDIT)).toBe(true)
  })
})

// ── requirePermission ─────────────────────────────────────────────────────────

describe("requirePermission", () => {
  it("admin 始终放行", async () => {
    const { status } = await runMiddleware(
      () => requirePermission(PERMISSIONS.USER_EDIT),
      { sub: "1", username: "admin", role: "admin" }
    )
    expect(status).toBe(200)
  })

  it("角色拥有权限 → 放行", async () => {
    const { status } = await runMiddleware(
      () => requirePermission(PERMISSIONS.USER_VIEW),
      { sub: "2", username: "bob", role: "user" }
    )
    expect(status).toBe(200)
  })

  it("角色无权限 → 403 + FORBIDDEN", async () => {
    const { status, body } = await runMiddleware(
      () => requirePermission(PERMISSIONS.USER_EDIT),
      { sub: "2", username: "bob", role: "viewer" }
    )
    expect(status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.code).toBe("FORBIDDEN")
  })

  it("多 code ANY 语义：拥有其一即放行", async () => {
    const { status } = await runMiddleware(
      () => requirePermission(PERMISSIONS.USER_EDIT, PERMISSIONS.USER_VIEW),
      { sub: "2", username: "bob", role: "user" }
    )
    expect(status).toBe(200)
  })

  it("无用户 → 403", async () => {
    const { status } = await runMiddleware(() =>
      requirePermission(PERMISSIONS.USER_VIEW)
    )
    expect(status).toBe(403)
  })
})

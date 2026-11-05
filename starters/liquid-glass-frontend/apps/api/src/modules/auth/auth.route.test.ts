/**
 * modules/auth 集成测试（route + service + 登录审计）
 *
 * 覆盖：POST /auth/login（DB 用户 / 不存在拒绝 / 校验失败）、
 * POST /auth/refresh（旋转 / 失效）响应形状与迁移前 routes/auth.ts 一致
 * （B3 起 login 的 user 向后兼容地新增 permissions），
 * 以及登录成功/失败审计断言（result / severity）。
 *
 * 运行方式：bun test src/modules/auth/auth.route.test.ts
 */
import { beforeAll, describe, expect, it } from "bun:test"
import { Hono } from "hono"
import jwt from "jsonwebtoken"
import { ALL_PERMISSIONS, DEFAULT_ROLE, ROLE_PERMISSIONS } from "shared"

import { getDrizzle } from "../../db.js"
import { auditLogs, users } from "../../db/schema.js"
import { JWT_SECRET } from "../../middleware/auth.js"
import { postJson, setupTestDb } from "../../test-helpers.js"
import authRoute from "./auth.route.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DB_USER = { email: "admin", name: "Admin", role: "admin" }

let app: Hono

beforeAll(() => {
  setupTestDb()
  getDrizzle().insert(users).values(DB_USER).run()

  app = new Hono()
  app.route("/auth", authRoute)
})

function loginLogs() {
  return getDrizzle()
    .select()
    .from(auditLogs)
    .all()
    .filter((l) => l.eventType === "login")
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  it("DB 用户登录 → 200，返回 token 对 + user，且写成功审计", async () => {
    const { status, body } = await postJson(app, "/auth/login", {
      email: DB_USER.email,
      password: "admin123",
    })
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe("登录成功")

    const data = body.data as {
      accessToken: string
      refreshToken: string
      user: {
        name: string
        email: string
        role: string
        permissions: string[]
      }
    }
    expect(data.accessToken).toBeTruthy()
    expect(data.refreshToken).toBeTruthy()
    // permissions 由 role 解析后随 user 下发（前端权限门控只消费该数组）
    expect(data.user).toEqual({
      name: "Admin",
      email: "admin",
      role: "admin",
      permissions: ALL_PERMISSIONS,
    })

    // accessToken 可用 JWT_SECRET 验签，sub 为邮箱
    const payload = jwt.verify(data.accessToken, JWT_SECRET) as { sub: string }
    expect(payload.sub).toBe(DB_USER.email)

    // 登录成功审计：module=user、result=success、severity=info（inferSeverity）
    const log = loginLogs().find((l) => l.operatorAccount === DB_USER.email)
    expect(log).toBeDefined()
    expect(log!.module).toBe("user")
    expect(log!.result).toBe("success")
    expect(log!.severity).toBe("info")
    expect(log!.target).toBe("Admin")
  })

  it("DB role 为 NULL → permissions 与 JWT 角色同源（默认角色），不出现前后端分裂", async () => {
    const noRole = {
      email: "norole-login@example.com",
      name: "无角色",
      role: null,
    }
    getDrizzle().insert(users).values(noRole).run()

    const { status, body } = await postJson(app, "/auth/login", {
      email: noRole.email,
      password: "admin123",
    })
    expect(status).toBe(200)

    const data = body.data as {
      accessToken: string
      user: { role: string | null; permissions: string[] }
    }
    expect(data.user.role).toBeNull()
    expect(data.user.permissions).toEqual(ROLE_PERMISSIONS[DEFAULT_ROLE])

    // token 内的兜底角色必须与响应 permissions 同源（hasPermission 按 JWT role 判权）
    const payload = jwt.verify(data.accessToken, JWT_SECRET) as { role: string }
    expect(payload.role).toBe(DEFAULT_ROLE)
  })

  it("库中无此邮箱 → 401 拒绝登录，写失败审计", async () => {
    const { status, body } = await postJson(app, "/auth/login", {
      email: "ghost@example.com",
      password: "secret123",
    })
    expect(status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.code).toBe("LOGIN_FAILED")
    expect(body.message).toBe("用户不存在")

    const failure = loginLogs().find(
      (l) => l.operatorAccount === "ghost@example.com"
    )
    expect(failure).toBeDefined()
    expect(failure!.result).toBe("failure")
    expect(failure!.severity).toBe("warning")
  })

  it("缺少账号 → 400「请输入账号」，写失败审计（warning + failure）", async () => {
    const { status, body } = await postJson(app, "/auth/login", {
      email: "",
      password: "secret123",
    })
    expect(status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.message).toBe("请输入账号")

    const failure = loginLogs().find((l) => l.result === "failure")
    expect(failure).toBeDefined()
    expect(failure!.severity).toBe("warning")
    expect(failure!.detail).toContain("登录失败")
  })

  it("密码过短 → 400「密码至少需要 6 位」", async () => {
    const { status, body } = await postJson(app, "/auth/login", {
      email: "someone@example.com",
      password: "123",
    })
    expect(status).toBe(400)
    expect(body.message).toBe("密码至少需要 6 位")
  })
})

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe("POST /auth/refresh", () => {
  it("有效 refreshToken → 200 新 token 对，旧 token 作废（旋转）", async () => {
    const login = await postJson(app, "/auth/login", {
      email: DB_USER.email,
      password: "admin123",
    })
    const { refreshToken } = login.body.data as { refreshToken: string }

    // refreshToken 以 Date.now() 生成，隔 2ms 避免新旧 token 同毫秒碰撞
    await new Promise((r) => setTimeout(r, 2))

    const first = await postJson(app, "/auth/refresh", { refreshToken })
    expect(first.status).toBe(200)
    expect(first.body.message).toBe("刷新成功")
    const data = first.body.data as {
      accessToken: string
      refreshToken: string
    }
    expect(data.accessToken).toBeTruthy()
    expect(data.refreshToken).toBeTruthy()
    expect(data.refreshToken).not.toBe(refreshToken)

    // 旧 refreshToken 已作废，重放 → 401
    const replay = await postJson(app, "/auth/refresh", { refreshToken })
    expect(replay.status).toBe(401)
    expect(replay.body.code).toBe("TOKEN_EXPIRED")
    expect(replay.body.message).toBe("refreshToken 无效或已过期")
  })

  it("缺失/非法 refreshToken → 401 TOKEN_EXPIRED", async () => {
    const missing = await postJson(app, "/auth/refresh", {})
    expect(missing.status).toBe(401)
    expect(missing.body.code).toBe("TOKEN_EXPIRED")

    const bogus = await postJson(app, "/auth/refresh", {
      refreshToken: "not-a-real-token",
    })
    expect(bogus.status).toBe(401)
    expect(bogus.body.code).toBe("TOKEN_EXPIRED")
  })
})

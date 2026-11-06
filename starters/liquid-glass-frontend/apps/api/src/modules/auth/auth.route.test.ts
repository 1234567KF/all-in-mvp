/**
 * modules/auth 集成测试（route + service + 登录审计）
 *
 * 覆盖：POST /auth/login（DB 用户 / 不存在拒绝 / 密码错误 / 校验失败）、
 * POST /auth/refresh（旋转 / 失效）、POST /auth/change-password（改密 + 原密码错误 +
 * 未认证 + refreshToken 吊销）响应形状与迁移前 routes/auth.ts 一致
 * （B3 起 login 的 user 向后兼容地新增 permissions），
 * 以及登录成功/失败、改密成功/失败审计断言（result / severity）。
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
import { hashPasswordSync } from "../../utils/password.js"
import authRoute from "./auth.route.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PASSWORD = "admin123"
/** 与 DEV_SEED_PASSWORD 同值：登录口令的 dev 约定（见 db/seed-users.ts） */
const DB_USER = {
  email: "admin",
  name: "Admin",
  role: "admin",
  password: hashPasswordSync(PASSWORD),
}

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

function changePwdLogs() {
  return getDrizzle()
    .select()
    .from(auditLogs)
    .all()
    .filter((l) => l.eventType === "change_pwd")
}

/** 登录并返回 accessToken / refreshToken */
async function doLogin(email: string, password: string) {
  const { status, body } = await postJson(app, "/auth/login", {
    email,
    password,
  })
  const data = body.data as { accessToken: string; refreshToken: string }
  return { status, data }
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  it("DB 用户登录 → 200，返回 token 对 + user，且写成功审计", async () => {
    const { status, body } = await postJson(app, "/auth/login", {
      email: DB_USER.email,
      password: PASSWORD,
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

  it("密码错误 → 401「密码错误」，写失败审计（warning + failure）", async () => {
    const { status, body } = await postJson(app, "/auth/login", {
      email: DB_USER.email,
      password: "wrong-password",
    })
    expect(status).toBe(401)
    expect(body.code).toBe("LOGIN_FAILED")
    expect(body.message).toBe("密码错误")

    // 与「用户不存在」同为 401 LOGIN_FAILED，但 detail 必须可区分（爆破 vs 拼错账号）
    const failure = loginLogs().find(
      (l) => l.operatorAccount === DB_USER.email && l.result === "failure"
    )
    expect(failure).toBeDefined()
    expect(failure!.severity).toBe("warning")
    expect(failure!.detail).toBe("登录失败：密码错误")
  })

  it("password 为 NULL（SSO 类账号）→ 拒绝密码登录，不参与比对", async () => {
    const sso = { email: "sso@example.com", name: "SSO 用户", role: "user" }
    getDrizzle().insert(users).values(sso).run()

    const { status, body } = await postJson(app, "/auth/login", {
      email: sso.email,
      password: PASSWORD,
    })
    expect(status).toBe(401)
    expect(body.message).toBe("该账号未启用密码登录")
  })

  it("DB role 为 NULL → permissions 与 JWT 角色同源（默认角色），不出现前后端分裂", async () => {
    const noRole = {
      email: "norole-login@example.com",
      name: "无角色",
      role: null,
      password: hashPasswordSync(PASSWORD),
    }
    getDrizzle().insert(users).values(noRole).run()

    const { status, body } = await postJson(app, "/auth/login", {
      email: noRole.email,
      password: PASSWORD,
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
      password: PASSWORD,
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

// ── POST /auth/change-password ───────────────────────────────────────────────
// 用独立账号：改密会改写 users.password，复用 admin 会让上面的登录用例依赖执行顺序

const OLD_PWD = "old-pass-1"
const NEW_PWD = "new-pass-2"
const PWD_USER = {
  email: "pwd-user@example.com",
  name: "改密用户",
  role: "user",
  password: hashPasswordSync(OLD_PWD),
}

describe("POST /auth/change-password", () => {
  beforeAll(() => {
    getDrizzle().insert(users).values(PWD_USER).run()
  })

  it("未认证 → 401（本端点挂 authMiddleware，login/refresh 仍是匿名入口）", async () => {
    const { status, body } = await postJson(app, "/auth/change-password", {
      oldPassword: OLD_PWD,
      newPassword: NEW_PWD,
    })
    expect(status).toBe(401)
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("原密码错误 → 400 OLD_PASSWORD_INCORRECT，写失败审计且原密码仍可登录", async () => {
    const { data } = await doLogin(PWD_USER.email, OLD_PWD)

    const { status, body } = await postJson(
      app,
      "/auth/change-password",
      { oldPassword: "bad-pass", newPassword: NEW_PWD },
      data.accessToken
    )
    expect(status).toBe(400)
    expect(body.code).toBe("OLD_PASSWORD_INCORRECT")

    const failure = changePwdLogs().find(
      (l) => l.operatorAccount === PWD_USER.email && l.result === "failure"
    )
    expect(failure).toBeDefined()
    expect(failure!.severity).toBe("warning")
    expect(failure!.detail).toBe("修改密码失败：原密码不正确")

    // 未被修改：旧密码依然可用
    expect((await doLogin(PWD_USER.email, OLD_PWD)).status).toBe(200)
  })

  it("新密码与原密码相同 → 400 字段级校验（shared ChangePasswordSchema.refine）", async () => {
    const { data } = await doLogin(PWD_USER.email, OLD_PWD)

    const { status, body } = await postJson(
      app,
      "/auth/change-password",
      { oldPassword: OLD_PWD, newPassword: OLD_PWD },
      data.accessToken
    )
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect((body.errors as Record<string, string>).newPassword).toBe(
      "新密码不能与原密码相同"
    )
  })

  it("改密成功 → 200 + 新密码可登录 + 旧密码失效 + 旧 refreshToken 被吊销 + 成功审计", async () => {
    const { data } = await doLogin(PWD_USER.email, OLD_PWD)
    await new Promise((r) => setTimeout(r, 2)) // refreshToken 按毫秒生成，避免同毫秒碰撞

    const { status } = await postJson(
      app,
      "/auth/change-password",
      { oldPassword: OLD_PWD, newPassword: NEW_PWD },
      data.accessToken
    )
    expect(status).toBe(200)

    expect((await doLogin(PWD_USER.email, NEW_PWD)).status).toBe(200)
    expect((await doLogin(PWD_USER.email, OLD_PWD)).status).toBe(401)

    // 会话续期凭证随改密作废（accessToken 无状态，仍在 1h 有效期内）
    const refresh = await postJson(app, "/auth/refresh", {
      refreshToken: data.refreshToken,
    })
    expect(refresh.status).toBe(401)
    expect(refresh.body.code).toBe("TOKEN_EXPIRED")

    const success = changePwdLogs().find(
      (l) => l.operatorAccount === PWD_USER.email && l.result === "success"
    )
    expect(success).toBeDefined()
    expect(success!.module).toBe("user")
    // change_pwd 的 severity 由 inferSeverity 推导为 warning
    expect(success!.severity).toBe("warning")
    expect(success!.target).toBe(PWD_USER.name)
  })

  it("库里已无此账号（token 未过期但账号被删）→ 401 UNAUTHORIZED", async () => {
    const orphanToken = jwt.sign(
      { sub: "deleted@example.com", username: "deleted", role: "user" },
      JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    )

    const { status, body } = await postJson(
      app,
      "/auth/change-password",
      { oldPassword: OLD_PWD, newPassword: NEW_PWD },
      orphanToken
    )
    expect(status).toBe(401)
    expect(body.code).toBe("UNAUTHORIZED")
  })
})

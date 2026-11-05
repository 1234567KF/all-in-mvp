/**
 * modules/user 集成测试（route + service + 审计）
 *
 * 覆盖：GET/PUT /users/me 响应形状（与迁移前 routes/users.ts 一致；B3 起
 * data.user 向后兼容地新增按 role 解析的 permissions）、
 * 401/404/400 错误路径、auditedUpdate 审计断言（changes diff 结构）。
 *
 * 运行方式：bun test src/modules/user/user.route.test.ts
 */
import { beforeAll, describe, expect, it } from "bun:test"
import { Hono } from "hono"
import jwt from "jsonwebtoken"
import { DEFAULT_ROLE, ROLE_PERMISSIONS } from "shared"

import { getDrizzle } from "../../db.js"
import { auditLogs, users } from "../../db/schema.js"
import { JWT_SECRET } from "../../middleware/auth.js"
import { setupTestDb } from "../../test-helpers.js"
import usersRoute from "./user.route.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ME = { email: "me@example.com", name: "本人", role: "user" }

function signToken(email: string) {
  return jwt.sign({ sub: email, username: email, role: "user" }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  })
}

let app: Hono
let token: string

beforeAll(() => {
  setupTestDb()
  getDrizzle().insert(users).values(ME).run()

  app = new Hono()
  app.route("/users", usersRoute)
  token = signToken(ME.email)
})

async function request(
  method: string,
  url: string,
  body?: unknown,
  rawBody?: string,
  useToken = true
) {
  const headers: Record<string, string> = {}
  if (body !== undefined || rawBody !== undefined) {
    headers["Content-Type"] = "application/json"
  }
  if (useToken) headers["Authorization"] = `Bearer ${token}`
  const res = await app.request(url, {
    method,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  return { status: res.status, body: await res.json() }
}

function updateLogs() {
  return getDrizzle()
    .select()
    .from(auditLogs)
    .all()
    .filter((l) => l.eventType === "update")
}

// ── GET /users/me ─────────────────────────────────────────────────────────────

describe("GET /users/me", () => {
  it("无 token → 401", async () => {
    const { status, body } = await request(
      "GET",
      "/users/me",
      undefined,
      undefined,
      false
    )
    expect(status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("有效 token → 200，data.user 含 role 解析出的 permissions", async () => {
    const { status, body } = await request("GET", "/users/me")
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    const user = (body.data as { user: Record<string, unknown> }).user
    expect(user.email).toBe(ME.email)
    expect(user.name).toBe(ME.name)
    expect(user.role).toBe(ME.role)
    // 前端 usePermission 只消费该数组
    expect(user.permissions).toEqual(ROLE_PERMISSIONS.user)
  })

  it("role 为 null（未配置）→ permissions 按 DEFAULT_ROLE 解析（与 JWT 兜底一致）", async () => {
    const noRole = { email: "norole@example.com", name: "无角色", role: null }
    getDrizzle().insert(users).values(noRole).run()
    const res = await app.request("/users/me", {
      headers: { Authorization: `Bearer ${signToken(noRole.email)}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const user = (body.data as { user: Record<string, unknown> }).user
    expect(user.permissions).toEqual(ROLE_PERMISSIONS[DEFAULT_ROLE])
  })

  it("token 对应用户不存在 → 404 USER_NOT_FOUND", async () => {
    const ghost = signToken("ghost@example.com")
    const res = await app.request("/users/me", {
      headers: { Authorization: `Bearer ${ghost}` },
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe("USER_NOT_FOUND")
    expect(body.message).toBe("用户不存在")
  })
})

// ── PUT /users/me ─────────────────────────────────────────────────────────────

describe("PUT /users/me", () => {
  it("畸形 JSON → 400", async () => {
    const { status, body } = await request(
      "PUT",
      "/users/me",
      undefined,
      "{bad json"
    )
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("参数校验失败（name 为空串）→ 400，且不写审计", async () => {
    const countBefore = updateLogs().length
    const { status, body } = await request("PUT", "/users/me", { name: "" })
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.message).toBe("请求参数校验失败")
    expect(updateLogs().length).toBe(countBefore)
  })

  it("空 body → 400，errors._form 携带 refine 文案（前端可回填表单根）", async () => {
    const { status, body } = await request("PUT", "/users/me", {})
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
    const errors = body.errors as Record<string, string> | undefined
    expect(errors?._form).toBe("至少提供一个要更新的字段")
  })

  it("更新成功 → 200 data.user，audit_logs 落 update 记录且 changes 结构正确", async () => {
    const { status, body } = await request("PUT", "/users/me", {
      name: "新名字",
    })
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe("更新成功")
    const user = (body.data as { user: Record<string, unknown> }).user
    expect(user.name).toBe("新名字")
    expect(user.email).toBe(ME.email)
    expect(user.permissions).toEqual(ROLE_PERMISSIONS.user)

    // 审计断言：auditedUpdate 自动 diff，changes key 为中文标签
    const logs = updateLogs()
    expect(logs.length).toBe(1)
    const log = logs[0]
    expect(log.module).toBe("user")
    expect(log.operatorAccount).toBe(ME.email)
    expect(log.target).toBe(ME.name)
    expect(log.result).toBe("success")

    const changes = JSON.parse(log.changes ?? "")
    expect(changes["姓名"]).toEqual({ before: "本人", after: "新名字" })
    // 未变更列不出现在 diff 中
    expect(changes["邮箱"]).toBeUndefined()
    expect(changes["角色"]).toBeUndefined()
  })

  it("无实际变更 → 200 但不新增审计记录", async () => {
    const countBefore = updateLogs().length
    const { status } = await request("PUT", "/users/me", { name: "新名字" })
    expect(status).toBe(200)
    expect(updateLogs().length).toBe(countBefore)
  })

  // 放最后：本用例会写一条 update 审计，避免影响前面 countBefore 断言
  it("role 为 null 的用户 PUT 成功 → permissions 按 DEFAULT_ROLE 解析", async () => {
    const noRole = {
      email: "norole-update@example.com",
      name: "无角色更新",
      role: null,
    }
    getDrizzle().insert(users).values(noRole).run()
    const res = await app.request("/users/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${signToken(noRole.email)}`,
      },
      body: JSON.stringify({ name: "改名成功" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const user = (body.data as { user: Record<string, unknown> }).user
    expect(user.permissions).toEqual(ROLE_PERMISSIONS[DEFAULT_ROLE])
  })
})

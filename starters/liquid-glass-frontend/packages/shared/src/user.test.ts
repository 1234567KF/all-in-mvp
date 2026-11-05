/**
 * 用户共享契约测试（api / web 单一事实源）
 *
 * 锁定 GET/PUT /users/me 的 wire 形状与入参校验：api route 用它校验请求体，
 * web service 用它类型化响应，两侧必须对「哪些字段可缺省、demo 账号是否合法」
 * 达成一致。
 */
import { describe, expect, it } from "vitest"

import {
  type UpdateMeInput,
  UpdateMeSchema,
  type User,
  UserSchema,
} from "./user.js"

// ── UserSchema ───────────────────────────────────────────────────────────────

describe("UserSchema", () => {
  const fullUser = {
    id: 1,
    email: "user@example.com",
    name: "测试用户",
    role: "user",
    permissions: ["user:view"],
    createdAt: "2026-01-01T00:00:00.000Z",
  }

  it("解析全量用户（含 role / permissions / createdAt）", () => {
    const user: User = UserSchema.parse(fullUser)
    expect(user).toEqual(fullUser)
  })

  it("最小用户：仅 email + name（登录会话响应可能不返回 id/role/createdAt）", () => {
    expect(UserSchema.parse({ email: "admin", name: null })).toEqual({
      email: "admin",
      name: null,
    })
  })

  it("name key 必有：缺省拒绝、显式 null 合法", () => {
    expect(UserSchema.safeParse({ email: "admin" }).success).toBe(false)
    expect(UserSchema.safeParse({ email: "admin", name: null }).success).toBe(
      true
    )
  })

  it("email 不能为空串；且不套用 z.email（demo 账号可以是 admin）", () => {
    expect(UserSchema.safeParse({ email: "", name: null }).success).toBe(false)
    expect(UserSchema.safeParse({ name: null }).success).toBe(false)
    expect(UserSchema.parse({ email: "admin", name: null }).email).toBe("admin")
  })

  it("id 非法值拒绝（0、负数、小数、字符串）", () => {
    expect(UserSchema.safeParse({ ...fullUser, id: 0 }).success).toBe(false)
    expect(UserSchema.safeParse({ ...fullUser, id: -1 }).success).toBe(false)
    expect(UserSchema.safeParse({ ...fullUser, id: 1.5 }).success).toBe(false)
    expect(UserSchema.safeParse({ ...fullUser, id: "1" }).success).toBe(false)
  })

  it("permissions 必须是字符串数组", () => {
    expect(
      UserSchema.safeParse({ email: "admin", name: null, permissions: [1] })
        .success
    ).toBe(false)
  })
})

// ── UpdateMeSchema ───────────────────────────────────────────────────────────

describe("UpdateMeSchema", () => {
  it("空对象被 refine 拒绝，message 为可读中文（wire 形状由 user.route.test 锁定）", () => {
    const result = UpdateMeSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("至少提供一个要更新的字段")
    }
  })

  it("name 为空串拒绝（与 route「参数校验失败」分支一致）", () => {
    expect(UpdateMeSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("合法 name 通过，推导出 UpdateMeInput", () => {
    const input: UpdateMeInput = UpdateMeSchema.parse({ name: "新名字" })
    expect(input.name).toBe("新名字")
  })
})

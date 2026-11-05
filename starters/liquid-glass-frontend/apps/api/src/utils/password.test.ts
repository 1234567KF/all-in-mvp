import { describe, expect, it } from "bun:test"

import { hashPassword, hashPasswordSync, verifyPassword } from "./password.js"

describe("verifyPassword", () => {
  it("bcrypt hash 格式：正确密码通过", async () => {
    const hash = hashPasswordSync("secret123")
    expect(await verifyPassword("secret123", hash)).toBe(true)
  })

  it("bcrypt hash 格式：错误密码拒绝", async () => {
    const hash = hashPasswordSync("secret123")
    expect(await verifyPassword("wrong", hash)).toBe(false)
  })

  it("存储值非 bcrypt hash（如明文）一律拒绝", async () => {
    expect(await verifyPassword("plaintext", "plaintext")).toBe(false)
  })
})

describe("hashPasswordSync", () => {
  it("输出为 bcrypt 格式（$2a$ 或 $2b$ 前缀）", () => {
    const hash = hashPasswordSync("mypassword")
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true)
  })
})

describe("hashPassword", () => {
  it("异步版本，输出为 bcrypt 格式", async () => {
    const hash = await hashPassword("mypassword")
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true)
  })
})

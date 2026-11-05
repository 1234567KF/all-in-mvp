import { describe, expect, it } from "bun:test"
import { z } from "zod"

import { firstZodError, formatZodErrors } from "./validation.js"

// ── 测试用 schema ────────────────────────────────────────────
const fieldSchema = z.object({
  name: z.string().min(2, "名字至少2个字符"),
  email: z.string().email("邮箱格式不正确"),
  age: z.number().min(0, "年龄不能为负"),
})

const formSchema = z
  .object({
    password: z.string(),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "两次密码不一致",
  })

const mixedSchema = z
  .object({
    password: z.string().min(6, "密码至少6字符"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "两次密码不一致",
  })

// 单字段多错误 schema：min + 两条 regex，构造 3 条 issues
const multiErrorSchema = z.object({
  pass: z
    .string()
    .min(6, "至少6字符")
    .regex(/[0-9]/, "需含数字")
    .regex(/[A-Z]/, "需含大写"),
})

// ── formatZodErrors ──────────────────────────────────────────
describe("formatZodErrors", () => {
  describe("success 结果", () => {
    it("成功 parse 返回空对象", () => {
      const result = fieldSchema.safeParse({
        name: "张三",
        email: "a@b.com",
        age: 18,
      })
      expect(formatZodErrors(result)).toEqual({})
    })
  })

  describe("字段级错误", () => {
    it("单字段错误 — 返回 { field: firstMessage }", () => {
      const result = fieldSchema.safeParse({
        name: "a",
        email: "a@b.com",
        age: 18,
      })
      expect(formatZodErrors(result)).toEqual({
        name: "名字至少2个字符",
      })
    })

    it("多字段错误 — 每个字段取首条消息", () => {
      const result = fieldSchema.safeParse({
        name: "a",
        email: "not-email",
        age: -1,
      })
      expect(formatZodErrors(result)).toEqual({
        name: "名字至少2个字符",
        email: "邮箱格式不正确",
        age: "年龄不能为负",
      })
    })

    it("单字段多条错误 — 仅保留首条", () => {
      const result = multiErrorSchema.safeParse({ pass: "a" })
      const errors = formatZodErrors(result)
      expect(errors.pass).toBe("至少6字符")
      expect(Object.keys(errors)).toEqual(["pass"])
    })
  })

  describe("form 级错误 (顶层 refine)", () => {
    it("refine 失败 — 归入 _form 键", () => {
      const result = formSchema.safeParse({
        password: "abc",
        confirm: "xyz",
      })
      const errors = formatZodErrors(result)
      expect(errors._form).toBe("两次密码不一致")
    })

    it("字段错误与 form 错误同时存在 — 两者都返回", () => {
      const result = mixedSchema.safeParse({
        password: "abc",
        confirm: "xyz",
      })
      const errors = formatZodErrors(result)
      expect(errors.password).toBe("密码至少6字符")
      expect(errors._form).toBe("两次密码不一致")
    })
  })
})

// ── firstZodError ────────────────────────────────────────────
describe("firstZodError", () => {
  it("success 结果返回空字符串", () => {
    const result = fieldSchema.safeParse({
      name: "张三",
      email: "a@b.com",
      age: 18,
    })
    expect(firstZodError(result)).toBe("")
  })

  it("失败结果返回首条 issue 的 message", () => {
    const result = fieldSchema.safeParse({
      name: "a",
      email: "not-email",
      age: -1,
    })
    expect(firstZodError(result)).toBe("名字至少2个字符")
  })

  it("失败但 issues 为空 — 返回兜底文案", () => {
    // 边界情况：构造 success=false 但 issues=[] 的假 result
    // 实际 Zod 不会产生这种结果，但 ?? 兜底分支需覆盖
    const fakeResult = {
      success: false,
      error: { issues: [] },
    } as never
    expect(firstZodError(fakeResult)).toBe("参数校验失败")
  })
})

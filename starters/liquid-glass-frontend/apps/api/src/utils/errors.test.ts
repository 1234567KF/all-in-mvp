import { describe, expect, it } from "bun:test"

import { extractErrorMessage } from "./errors.js"

describe("extractErrorMessage", () => {
  it("Error 实例 — 返回 message", () => {
    expect(extractErrorMessage(new Error("网络超时"))).toBe("网络超时")
  })

  it("带 message 属性的普通对象 — 返回 message", () => {
    expect(extractErrorMessage({ message: "参数错误" })).toBe("参数错误")
  })

  it("null 输入 — 返回兜底文案", () => {
    expect(extractErrorMessage(null)).toBe("操作失败")
  })

  it("undefined 输入 — 返回兜底文案", () => {
    expect(extractErrorMessage(undefined)).toBe("操作失败")
  })

  it("非字符串 message — 返回兜底文案", () => {
    expect(extractErrorMessage({ message: 123 })).toBe("操作失败")
    expect(extractErrorMessage({ message: "" })).toBe("操作失败")
  })

  it("无 message 的普通对象 — 返回兜底文案", () => {
    expect(extractErrorMessage({ code: 500 })).toBe("操作失败")
  })

  it("字符串输入 — 返回兜底文案", () => {
    expect(extractErrorMessage("some error")).toBe("操作失败")
  })
})

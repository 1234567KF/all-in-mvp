import { describe, expect, it } from "vitest"

import { EMPTY_VALUE, formatAmount, formatEmpty } from "@/lib/format"

describe("formatAmount", () => {
  it(">= 10000 显示为 X.X万", () => {
    expect(formatAmount(10000)).toBe("1.0万")
    expect(formatAmount(15000)).toBe("1.5万")
    expect(formatAmount(123456)).toBe("12.3万")
  })

  it("< 10000 本地化数字", () => {
    expect(formatAmount(0)).toBe("0")
    expect(formatAmount(999)).toBe("999")
    // toLocaleString 结果依赖 locale，用正则匹配千分位分隔符
    expect(formatAmount(9999)).toMatch(/9[.,\s]999/)
  })
})

describe("formatEmpty", () => {
  it("null / undefined / 空白字符串返回占位符 —", () => {
    expect(formatEmpty(null)).toBe(EMPTY_VALUE)
    expect(formatEmpty(undefined)).toBe(EMPTY_VALUE)
    expect(formatEmpty("")).toBe(EMPTY_VALUE)
    expect(formatEmpty("   ")).toBe(EMPTY_VALUE)
  })

  it("有值时转为字符串返回", () => {
    expect(formatEmpty("文本")).toBe("文本")
    expect(formatEmpty(0)).toBe("0")
    expect(formatEmpty(false)).toBe("false")
  })

  it("支持自定义占位符", () => {
    expect(formatEmpty(null, "无")).toBe("无")
  })
})

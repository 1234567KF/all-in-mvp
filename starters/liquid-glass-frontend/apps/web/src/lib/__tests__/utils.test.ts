/**
 * utils 工具函数测试 — 示例模板
 *
 * 覆盖 cn()（clsx + tailwind-merge）的合并与去重行为。
 */

import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn", () => {
  it("合并多个类名字符串", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("过滤 falsy 值（条件类名）", () => {
    expect(cn("text-sm", false, null, undefined, "font-bold")).toBe(
      "text-sm font-bold"
    )
  })

  it("后者覆盖冲突的 tailwind 类（twMerge）", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("支持数组与对象条件写法", () => {
    expect(cn(["text-sm"], { hidden: false, block: true })).toBe(
      "text-sm block"
    )
  })
})

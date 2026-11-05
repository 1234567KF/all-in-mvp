/**
 * audit-diff 纯逻辑单测
 * 覆盖 changes → 行数组归一化（普通 diff 形 / snapshot 新增与删除 / 非法数据兜底）。
 */
import { describe, expect, it } from "vitest"

import { detectMode, toChangeRows } from "@/lib/audit-diff"

describe("toChangeRows", () => {
  it("普通 diff 形 → 逐字段行", () => {
    expect(toChangeRows({ 姓名: { before: "旧", after: "新" } })).toEqual([
      { field: "姓名", before: "旧", after: "新" },
    ])
  })

  it("snapshot 新增形 → 以 after 展开（before 为 undefined）", () => {
    expect(
      toChangeRows({
        snapshot: { before: null, after: { name: "新行", role: "user" } },
      })
    ).toEqual([
      { field: "name", before: undefined, after: "新行" },
      { field: "role", before: undefined, after: "user" },
    ])
  })

  it("snapshot 删除形 → 以 before 展开（after 为 undefined）", () => {
    expect(
      toChangeRows({
        snapshot: { before: { name: "旧行" }, after: null },
      })
    ).toEqual([{ field: "name", before: "旧行", after: undefined }])
  })

  it("空 changes / 非法 snapshot → 空数组（不抛错）", () => {
    expect(toChangeRows(null)).toEqual([])
    expect(toChangeRows(undefined)).toEqual([])
    expect(toChangeRows({ snapshot: { before: "raw", after: null } })).toEqual(
      []
    )
    // 坏数据（旧库 / 手工导入）：snapshot 为 null / 字符串时按空变更处理
    expect(toChangeRows({ snapshot: null as never })).toEqual([])
    expect(toChangeRows({ snapshot: "raw" as never })).toEqual([])
  })

  it("snapshot 中的 JSON 字符串字段反解析后可进入标签 / 对象三态", () => {
    const rows = toChangeRows({
      snapshot: {
        before: null,
        after: { roles: '["admin"]', config: '{"theme":"blue"}' },
      },
    })
    expect(rows[0].after).toEqual(["admin"])
    expect(rows[1].after).toEqual({ theme: "blue" })
    expect(detectMode(rows[0])).toBe("tags")
    expect(detectMode(rows[1])).toBe("object")
  })
})

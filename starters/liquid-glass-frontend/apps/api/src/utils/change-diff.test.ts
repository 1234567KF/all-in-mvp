import { describe, expect, it } from "bun:test"

import { buildChanges, buildDetail } from "./change-diff.js"

describe("buildChanges", () => {
  it("基本变更检测：name 从 A 改为 B", () => {
    const before = { name: "A", age: 20 }
    const after = { name: "B" }
    const result = buildChanges(before, after)
    expect(result).toEqual({
      name: { before: "A", after: "B" },
    })
  })

  it("无变更返回空对象", () => {
    const before = { name: "A", age: 20 }
    const after = { name: "A" }
    const result = buildChanges(before, after)
    expect(result).toEqual({})
  })

  it("部分更新只记录变化的字段", () => {
    const before = { name: "A", age: 20, city: "Beijing" }
    const after = { name: "B", age: 20, city: "Shanghai" }
    const result = buildChanges(before, after)
    expect(result).toEqual({
      name: { before: "A", after: "B" },
      city: { before: "Beijing", after: "Shanghai" },
    })
  })

  it("fieldLabels 映射生效", () => {
    const before = { name: "A", age: 20 }
    const after = { name: "B", age: 21 }
    const labels = { name: "姓名", age: "年龄" }
    const result = buildChanges(before, after, labels)
    expect(result).toEqual({
      姓名: { before: "A", after: "B" },
      年龄: { before: 20, after: 21 },
    })
  })

  it("undefined 值被跳过", () => {
    const before = { name: "A", age: 20 }
    const after = { name: "B", age: undefined }
    const result = buildChanges(before, after)
    expect(result).toEqual({
      name: { before: "A", after: "B" },
    })
  })

  it("空 after 对象返回空结果", () => {
    const before = { name: "A", age: 20 }
    const result = buildChanges(before, {})
    expect(result).toEqual({})
  })

  it("对象/数组类型值自动序列化为 JSON 字符串", () => {
    const before = { contacts: [{ name: "A", phone: "123" }] }
    const after = { contacts: [{ name: "B", phone: "456" }] }
    const result = buildChanges(before, after)
    expect(typeof result["contacts"].before).toBe("string")
    expect(typeof result["contacts"].after).toBe("string")
  })

  it("内容相同的数组不记录为变更（深比较）", () => {
    const before = { tags: [] as string[] }
    const after = { tags: [] as string[] }
    const result = buildChanges(before, after)
    expect(result).toEqual({})
  })

  it("数组内容变化正常记录", () => {
    const before = { tags: ["alpha"] }
    const after = { tags: ["alpha", "beta"] }
    const result = buildChanges(before, after, { tags: "标签" })
    expect(result).toHaveProperty("标签")
    expect(result["标签"].before).toBe('[\n  "alpha"\n]')
    expect(result["标签"].after).toBe('[\n  "alpha",\n  "beta"\n]')
  })
})

describe("buildDetail", () => {
  it("从结构化变更派生可读文本", () => {
    const detail = buildDetail({
      状态: { before: "pending", after: "approved" },
      负责人: { before: "", after: "张三" },
    })
    expect(detail).toBe("状态: pending → approved; 负责人: 空 → 张三")
  })

  it("空对象返回空字符串", () => {
    expect(buildDetail({})).toBe("")
  })
})

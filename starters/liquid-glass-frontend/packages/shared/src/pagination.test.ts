/**
 * 通用分页共享契约测试（api / web 单一事实源）
 *
 * 锁定 PageQuerySchema 的 HTTP query string 语义（缺省值 / 字符串强转 /
 * 空参数等价于未传 / 非法值拒绝）：route 层直接 safeParse(c.req.query())，
 * 这些行为一旦漂移，所有服务端分页列表都会静默出错。
 *
 * PagedResult<T> 是纯类型契约，编译期由 `tsc` 保证，无需运行时用例。
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  PageQueryBaseSchema,
  PageQuerySchema,
  stripBlankQueryValues,
} from "./pagination.js"

// ── 查询参数 ─────────────────────────────────────────────────────────────────

describe("PageQuerySchema", () => {
  it("缺省值：page=1、pageSize=20、sortOrder=desc，可选字段不注入", () => {
    expect(PageQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
    })
  })

  it("HTTP query string 字符串自动 coerce 为数字", () => {
    expect(PageQuerySchema.parse({ page: "2", pageSize: "50" })).toMatchObject({
      page: 2,
      pageSize: 50,
    })
  })

  it("page 必须是 ≥1 的整数（0、负数、小数、非数字拒绝）", () => {
    expect(PageQuerySchema.safeParse({ page: "0" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ page: "-1" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ page: "1.5" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ page: "abc" }).success).toBe(false)
  })

  it("pageSize 必须是 1~100 的整数", () => {
    expect(PageQuerySchema.safeParse({ pageSize: "0" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ pageSize: "2.5" }).success).toBe(false)
    expect(PageQuerySchema.parse({ pageSize: "100" }).pageSize).toBe(100)
  })

  it("keyword 自动 trim", () => {
    expect(PageQuerySchema.parse({ keyword: "  玻璃  " }).keyword).toBe("玻璃")
  })

  it("keyword / sortBy 可省略（层内不绑定具体业务列）", () => {
    const parsed = PageQuerySchema.parse({})
    expect("keyword" in parsed).toBe(false)
    expect("sortBy" in parsed).toBe(false)
  })

  it("sortBy 原样透传：白名单校验留给各业务 service", () => {
    expect(PageQuerySchema.parse({ sortBy: "createdAt" }).sortBy).toBe(
      "createdAt"
    )
  })

  it("sortOrder 只接受 asc / desc，缺省 desc", () => {
    expect(PageQuerySchema.parse({ sortOrder: "asc" }).sortOrder).toBe("asc")
    expect(PageQuerySchema.parse({ sortOrder: "desc" }).sortOrder).toBe("desc")
    expect(PageQuerySchema.parse({}).sortOrder).toBe("desc")
    expect(PageQuerySchema.safeParse({ sortOrder: "up" }).success).toBe(false)
  })

  // ── 空参数（表单未选择筛选项时的常见序列化产物） ──────────────────────────

  it("page/pageSize/sortOrder 为空串时回退默认值，不误报 400", () => {
    expect(
      PageQuerySchema.parse({ page: "", pageSize: "", sortOrder: "" })
    ).toEqual({ page: 1, pageSize: 20, sortOrder: "desc" })
  })

  it("keyword / sortBy 的空串与纯空白都视为未传", () => {
    const parsed = PageQuerySchema.parse({ keyword: "  ", sortBy: "" })
    expect("keyword" in parsed).toBe(false)
    expect("sortBy" in parsed).toBe(false)
  })

  it("空白以外的非法值仍拒绝（不做静默兜底）", () => {
    expect(PageQuerySchema.safeParse({ page: "zero" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ pageSize: "1e3" }).success).toBe(false)
    expect(PageQuerySchema.safeParse({ sortOrder: "ascending" }).success).toBe(
      false
    )
  })
})

// ── 契约复用（Batch 4 多维筛选 / 生成器组合） ───────────────────────────────

describe("PageQueryBaseSchema 可组合性", () => {
  it("可 extend 业务筛选，并复用 stripBlankQueryValues 的空参数语义", () => {
    const LogQuerySchema = z.preprocess(
      stripBlankQueryValues,
      PageQueryBaseSchema.extend({ module: z.string().optional() })
    )

    // 扩展字段与分页字段的空串都按「未传」处理
    expect(LogQuerySchema.parse({ module: "", page: "" })).toEqual({
      page: 1,
      pageSize: 20,
      sortOrder: "desc",
    })
    expect(LogQuerySchema.parse({ module: "user" }).module).toBe("user")
  })
})

// ── 根出口（下游唯一入口）───────────────────────────────────────────────────
// api / web 只能从 `shared` 根出口导入；扩展分页契约所需的两个符号漏导出会让
// Batch 4 的「分页 + 业务筛选」组合契约无法在调用侧落地。
describe("shared 根出口", () => {
  it("PageQueryBaseSchema / stripBlankQueryValues 可从 index 导出（下游只依赖 shared 根出口）", async () => {
    const sharedIndex = await import("./index.js")

    expect(sharedIndex.PageQueryBaseSchema).toBe(PageQueryBaseSchema)
    expect(sharedIndex.stripBlankQueryValues).toBe(stripBlankQueryValues)
  })
})

/**
 * 通用分页 — 业务无关的偏移分页契约（api / web 共用单一事实源）
 *
 * 设计边界（沉淀原则）：
 * - 只定义「怎么问」与「怎么答」：查询参数 schema + 响应泛型接口，
 *   不绑定任何具体表或业务字段，也不提供 offset/limit 等派生 helper；
 * - HTTP query string 里的值都是字符串，因此 page / pageSize 用 `z.coerce`
 *   自动强转数字，route 层可直接 `safeParse(c.req.query())`；
 * - 空参数（`?page=&keyword=`，表单未选择筛选项时的常见产物）语义上等价于未传，
 *   统一在入口剔除，让 default / optional 生效，避免 coerce("") → 0 误报 400；
 * - `sortBy` 只做字符串透传：排序列白名单（防 SQL 注入 / 暴露内部列）由各业务
 *   service 自行校验，通用层不感知具体表的可排序列。
 *
 * 组合方式：业务多维筛选复用分页契约时，不要直接改本文件——
 * ```ts
 * const LogQuerySchema = z.preprocess(
 *   stripBlankQueryValues,
 *   PageQueryBaseSchema.extend({ module: z.string().optional() })
 * )
 * ```
 * `PageQuerySchema` 已包好清洗逻辑；`PageQueryBaseSchema` 保留原始 ZodObject
 * 以便 `extend` / `shape` / `omit`（preprocess 包装后不再是 ZodObject）。
 */
import { z } from "zod"

/**
 * 剔除空串 / 纯空白 query 值（`?page=&keyword=` 视为未传），返回浅拷贝。
 * 导出以便扩展了分页契约的业务 schema 复用同一套空参数语义。
 */
export function stripBlankQueryValues(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const cleaned: Record<string, unknown> = {
    ...(raw as Record<string, unknown>),
  }
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === "string" && value.trim() === "") delete cleaned[key]
  }
  return cleaned
}

/** 基础分页对象 schema（可 `extend` 业务筛选；不含空参数清洗，组合时自行 preprocess） */
export const PageQueryBaseSchema = z.object({
  /** 第几页，从 1 开始 */
  page: z.coerce.number().int().min(1).default(1),
  /** 每页条数，上限 100 防大页拖垮服务 */
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** 关键字模糊搜索，自动 trim；具体匹配哪些列由业务 service 决定 */
  keyword: z.string().trim().optional(),
  /** 排序列，白名单由业务 service 校验 */
  sortBy: z.string().optional(),
  /** 排序方向，缺省倒序（列表页最常见的「最新在前」） */
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export type PageQuery = z.infer<typeof PageQueryBaseSchema>

/** 偏移分页查询参数（HTTP query string，空参数按未传处理） */
export const PageQuerySchema = z.preprocess(
  stripBlankQueryValues,
  PageQueryBaseSchema
)

/**
 * 偏移分页响应 — 泛型承载业务行类型
 *
 * `totalPages` 由服务端计算并返回，避免前端各页各自按 total/pageSize 重复推导。
 */
export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

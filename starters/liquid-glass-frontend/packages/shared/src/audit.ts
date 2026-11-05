/**
 * 审计日志常量
 * 集中管理 module / eventType / result 字面量，避免散布字符串
 *
 * 用途：Service 层声明审计元数据 + writeLog 调用时使用；
 *      前端展示筛选下拉时也可复用（通过 *_LABELS 映射渲染中文）。
 *
 * 项目按需扩展：新增业务模块时在 AUDIT_MODULES 补一条 + LABELS 补中文即可。
 */
import { z } from "zod"

import { PageQueryBaseSchema, stripBlankQueryValues } from "./pagination.js"

// ─── 审计模块（对应业务域，示例仅留 USER / SYSTEM 两条） ─────────────────────
export const AUDIT_MODULES = {
  // [gen:module:audit-modules] 由 bun run gen:module 追加业务模块审计模块名（勿手改本行）
  USER: "user",
  SYSTEM: "system",
} as const

export type AuditModule = (typeof AUDIT_MODULES)[keyof typeof AUDIT_MODULES]

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  // [gen:module:audit-module-labels] 由 bun run gen:module 追加业务模块审计标签（勿手改本行）
  user: "用户管理",
  system: "系统管理",
}

// ─── 审计事件类型 ─────────────────────────────────────────────────────────────
// CRUD 类：由 Service 层声明式包装器（audited-crud）自动写入
// 例外类（登录、密码等）：保留在 handler 内手动写入
export const AUDIT_EVENT_TYPES = {
  // ── CRUD 类 ──
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",

  // ── 例外类（登录、密码相关） ──
  LOGIN: "login",
  LOGOUT: "logout",
  CHANGE_PWD: "change_pwd",
} as const

export type AuditEventType =
  (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES]

export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  create: "新增",
  update: "编辑",
  delete: "删除",
  login: "登录",
  logout: "登出",
  change_pwd: "修改密码",
}

// ─── 审计结果 ─────────────────────────────────────────────────────────────────
export const AUDIT_RESULT = { SUCCESS: "success", FAILURE: "failure" } as const

export type AuditResult = (typeof AUDIT_RESULT)[keyof typeof AUDIT_RESULT]

export const AUDIT_RESULT_LABELS: Record<AuditResult, string> = {
  success: "成功",
  failure: "失败",
}

// ─── 严重程度 ─────────────────────────────────────────────────────────────────
// 与 audit_logs 表的 CHECK 约束保持一致（info / warning / error / critical）
// severity 由 inferSeverity() 按 eventType 推导，调用方也可显式覆盖。

export const AUDIT_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
} as const

export type AuditSeverity = (typeof AUDIT_SEVERITY)[keyof typeof AUDIT_SEVERITY]

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: "信息",
  warning: "警告",
  error: "错误",
  critical: "严重",
}

// ─── 筛选选项（顺序即 UI 下拉展示顺序）───────────────────────────────────────

/** 模块选项：由 AUDIT_MODULES 派生，与后端可写入模块全集保持同步 */
export const AUDIT_MODULE_OPTIONS: AuditModule[] = Object.values(AUDIT_MODULES)

/** 事件类型选项：由 AUDIT_EVENT_TYPES 派生 */
export const AUDIT_EVENT_TYPE_OPTIONS: AuditEventType[] =
  Object.values(AUDIT_EVENT_TYPES)

export const AUDIT_RESULT_OPTIONS = [
  "success",
  "failure",
] as const satisfies readonly AuditResult[]

export const AUDIT_SEVERITY_OPTIONS = [
  "info",
  "warning",
  "error",
  "critical",
] as const satisfies readonly AuditSeverity[]

/**
 * 模块 → 事件类型映射（前端级联筛选用）
 *
 * 预置映射：按当前 / 计划中的审计写入点维护，新增审计点时同步补充；
 * 未收录模块在 UI 侧 fallback 全量事件类型（不阻塞扩展）。
 */
export const MODULE_EVENT_TYPES: Record<string, readonly AuditEventType[]> = {
  // [gen:module:audit-module-event-types] 由 bun run gen:module 追加业务模块事件映射（勿手改本行）
  user: ["login", "logout", "change_pwd", "create", "update", "delete"],
  system: ["create", "update", "delete", "change_pwd"],
}

// ─── 审计日志 wire 契约（只读查询 API）──────────────────────────────────────

/**
 * 单字段变更条目：`{ before, after }`
 *
 * 取值形态由 audited-crud 决定：
 * - 标量字段：字符串 / 数字 / null
 * - 标签数组：string[]（如角色集合）
 * - 键值对象：JSON 字符串化前的扁平对象（change-diff 对对象做 JSON.stringify 比较）
 * - snapshot：新增/删除事件的整行快照（`{ snapshot: { before, after } }`）
 */
export const AuditChangeEntrySchema = z.object({
  before: z.unknown(),
  after: z.unknown(),
})

export type AuditChangeEntry = z.infer<typeof AuditChangeEntrySchema>

/** changes 的 key 是中文（TableAuditConfig.fieldLabels）或原始列名（snapshot 形） */
export const AuditChangesSchema = z.record(z.string(), AuditChangeEntrySchema)

export type AuditChanges = z.infer<typeof AuditChangesSchema>

/** 审计日志 wire 行（DB 行去掉 JSON 字符串：changes 已解析为结构化对象） */
export const AuditLogSchema = z.object({
  id: z.string(),
  operator: z.string(),
  operatorId: z.string(),
  operatorAccount: z.string(),
  operatorRole: z.string(),
  eventType: z.string(),
  module: z.string(),
  target: z.string(),
  targetId: z.string(),
  ipAddress: z.string(),
  result: z.string(),
  severity: z.string(),
  detail: z.string(),
  userAgent: z.string(),
  requestId: z.string(),
  changes: AuditChangesSchema.nullable(),
  createTime: z.string(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

/**
 * 时间边界归一化：接受完整 ISO 字符串或 `YYYY-MM-DD`（date-only 按 UTC 日边界补全）
 *
 * 写入侧 createTime 是 `new Date().toISOString()`，text 列按 ISO 字典序比较等价于
 * 时间比较；因此外部传参必须先归一化成同一格式。非法值置空交给 refine → 400，
 * 避免「静默返回空列表」把调用方的格式错误藏起来。
 */
const DATE_ONLY_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATETIME_PARTS_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/
const HAS_TIMEZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/

/** 日历合法性：拦截 2026-99-99 / 2026-02-30 这类「格式对但日历越界」的值（Date 会 Invalid 或静默进位） */
function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  // 第 0 天 = 上个月最后一天（本地时区对「天数」无影响）
  const daysInMonth = new Date(year, month, 0).getDate()
  return day <= daysInMonth
}

function isValidClockTime(
  hour: number,
  minute: number,
  second: number
): boolean {
  return hour <= 23 && minute <= 59 && second <= 59
}

/**
 * 时间边界归一化：接受完整 ISO 字符串或 `YYYY-MM-DD`（date-only 按 UTC 日边界补全）
 *
 * 先做日历合法性校验再 new Date：Zod 的 transform 不会捕获 `Invalid Date.toISOString()`
 * 抛出的 RangeError（会让接口 500），也不能放行 2026-02-30 被 Date 静默进位成 03-02。
 * 任意不合法输入统一返回空串，由 refine 转成 400。
 */
function normalizeTimeBoundary(value: string, edge: "start" | "end"): string {
  const dateOnly = DATE_ONLY_PARTS_RE.exec(value)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    if (!isValidCalendarDate(Number(year), Number(month), Number(day))) {
      return ""
    }
    return edge === "start"
      ? `${value}T00:00:00.000Z`
      : `${value}T23:59:59.999Z`
  }

  // 仅接受 ISO 日期时间（可省略时区：无时区按 UTC 解释，保证跨环境确定性；
  // 不交给 Date.parse 猜 "2026/01/03" 这类本地化格式）
  const parts = ISO_DATETIME_PARTS_RE.exec(value)
  if (!parts) return ""
  const [, year, month, day, hour, minute, second = "00"] = parts
  if (
    !isValidCalendarDate(Number(year), Number(month), Number(day)) ||
    !isValidClockTime(Number(hour), Number(minute), Number(second))
  ) {
    return ""
  }

  const withTz = HAS_TIMEZONE_RE.test(value) ? value : `${value}Z`
  const parsed = new Date(withTz.replace(" ", "T"))
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString()
}

const AuditTimeBoundarySchema = (edge: "start" | "end") =>
  z
    .string()
    .transform((value) => normalizeTimeBoundary(value, edge))
    .refine((value) => value !== "", {
      message: "时间格式必须为 ISO 8601 或 YYYY-MM-DD",
    })

/**
 * 审计日志查询契约（多维筛选 + 偏移分页）
 *
 * - 复用通用分页契约的 page / pageSize / keyword（空参数按未传处理）；
 * - 固定按 createTime 倒序（最新在前），因此不暴露 sortBy / sortOrder；
 * - result / severity 做枚举校验，拼错的筛选值直接 400 而不是静默空列表；
 * - startTime / endTime 归一化为 UTC ISO（支持 date-only），并校验开始 ≤ 结束。
 */
export const AuditLogQueryBaseSchema = PageQueryBaseSchema.pick({
  page: true,
  pageSize: true,
  keyword: true,
})
  .extend({
    module: z.string().optional(),
    eventType: z.string().optional(),
    result: z.enum(AUDIT_RESULT_OPTIONS).optional(),
    severity: z.enum(AUDIT_SEVERITY_OPTIONS).optional(),
    startTime: AuditTimeBoundarySchema("start").optional(),
    endTime: AuditTimeBoundarySchema("end").optional(),
  })
  .superRefine((query, ctx) => {
    if (query.startTime && query.endTime && query.startTime > query.endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "结束时间不能早于开始时间",
      })
    }
  })

export type AuditLogQuery = z.infer<typeof AuditLogQueryBaseSchema>

/** HTTP query string 版本：先剔除空串参数，再走 schema 默认值 */
export const AuditLogQuerySchema = z.preprocess(
  stripBlankQueryValues,
  AuditLogQueryBaseSchema
)

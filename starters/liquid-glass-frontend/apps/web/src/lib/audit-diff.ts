/**
 * audit-diff — 审计变更（changes）纯数据归一化与形状判定
 *
 * 从渲染组件中拆出的无副作用逻辑，便于单测与复用：
 * - toChangeRows：changes → 逐字段行；snapshot 形（新增/删除）展开为字段条目；
 * - detectMode：判定三态 Diff 模式（标量 / 标签数组 / 键值对象）；
 * - formatValue：值的统一展示格式（空值占位 / 对象 JSON 化）。
 *
 * 说明：audited-crud 的 buildChanges 会把对象/数组 JSON.stringify 后存储，
 * 因此这里对「JSON 形态字符串」做一次安全反解析，才能命中标签/对象模式。
 */
import type { AuditChanges } from "shared"

/** 变更行：field 为展示名（diff key 已是中文标签；snapshot 形为原始列名） */
export interface AuditChangeRow {
  field: string
  before: unknown
  after: unknown
}

/** 三态 Diff 模式 */
export type AuditDiffMode = "scalar" | "tags" | "object"

/** 缺失值的统一占位 */
export const EMPTY_DISPLAY = "—"

/** 安全反解析 JSON 形态字符串（对象 / 数组），失败保留原文 */
function normalizeValue(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  if (!looksLikeJson) return value
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

/** changes → 行数组；snapshot 形（新增/删除）展开为逐字段条目 */
export function toChangeRows(changes?: AuditChanges | null): AuditChangeRow[] {
  if (!changes) return []
  const keys = Object.keys(changes)

  if (keys.length === 1 && keys[0] === "snapshot") {
    const snapshot = changes.snapshot
    // 防御坏数据（旧库 / 手工导入）：snapshot 缺失或非对象时按空变更处理
    if (!snapshot || typeof snapshot !== "object") return []
    const { before, after } = snapshot as { before?: unknown; after?: unknown }
    const isCreate = after != null
    const source = isCreate ? after : before
    if (source && typeof source === "object" && !Array.isArray(source)) {
      return Object.entries(source as Record<string, unknown>).map(
        ([field, value]) => {
          // snapshot 列同样可能是 JSON 字符串（未进 jsonColumns 声明的数组/对象列）
          const normalized = normalizeValue(value)
          return {
            field,
            before: isCreate ? undefined : normalized,
            after: isCreate ? normalized : undefined,
          }
        }
      )
    }
    return []
  }

  return keys.flatMap((field) => {
    const entry = changes[field]
    if (!entry) return []
    return [
      {
        field,
        before: normalizeValue(entry.before),
        after: normalizeValue(entry.after),
      },
    ]
  })
}

/** 标签数组：元素均为标量的数组（如角色 / 权限集合） */
export function isTagArray(
  value: unknown
): value is Array<string | number | boolean> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
    )
  )
}

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** 判定变更行的渲染模式（两侧都需满足同一形状，否则回退标量） */
export function detectMode(row: AuditChangeRow): AuditDiffMode {
  const values = [row.before, row.after].filter(
    (value) => value !== undefined && value !== null
  )
  if (values.length > 0 && values.every(isTagArray)) return "tags"
  if (values.length > 0 && values.every(isPlainObject)) return "object"
  return "scalar"
}

/** 值的统一展示格式：空值占位，对象 JSON 化 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return EMPTY_DISPLAY
  }
  if (typeof value === "string") return value
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

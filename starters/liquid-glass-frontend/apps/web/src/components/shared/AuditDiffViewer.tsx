/**
 * AuditDiffViewer — 审计变更通用三态 Diff 渲染器
 *
 * 数据形态（shared/audit.ts 的 AuditChanges）：
 * - 标量对比：`{ 姓名: { before: "旧", after: "新" } }`
 * - 标签数组：`{ 角色: { before: ["admin"], after: ["admin", "viewer"] } }`
 * - 键值对象：`{ 配置: { before: '{"theme":"green"}', after: ... } }`
 * - snapshot 形（新增/删除）：`{ snapshot: { before: 整行, after: 整行 } }`
 *   自动展开为逐字段条目，无变更时回退空态文案。
 *
 * 说明：audited-crud 的 buildChanges 会把对象/数组 JSON.stringify 后存储，
 * 因此渲染前对「JSON 形态的字符串」做一次安全反解析，才能命中标签/对象模式。
 */
import { ArrowRight, Braces, FileText, Tags } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import type { AuditChanges } from "shared"

import {
  type AuditChangeRow,
  detectMode,
  formatValue,
  isPlainObject,
  isTagArray,
  toChangeRows,
} from "@/lib/audit-diff"
import { cn } from "@/lib/utils"

// ─── 语义色（token + color-mix，明暗主题自动适配；不硬编码颜色）───────────────

const BEFORE_BOX_STYLE = {
  borderColor: "color-mix(in srgb, var(--lg-danger) 22%, transparent)",
  background: "color-mix(in srgb, var(--lg-danger) 5%, transparent)",
}
const AFTER_BOX_STYLE = {
  borderColor: "color-mix(in srgb, var(--lg-success) 22%, transparent)",
  background: "color-mix(in srgb, var(--lg-success) 5%, transparent)",
}
const MODIFIED_ROW_STYLE = {
  borderColor: "color-mix(in srgb, var(--lg-warning) 22%, transparent)",
  background: "color-mix(in srgb, var(--lg-warning) 5%, transparent)",
}
const DELETED_TAG_STYLE = {
  borderColor: "color-mix(in srgb, var(--lg-danger) 30%, transparent)",
  background: "color-mix(in srgb, var(--lg-danger) 10%, transparent)",
  color: "var(--lg-danger)",
}
const ADDED_TAG_STYLE = {
  borderColor: "color-mix(in srgb, var(--lg-success) 30%, transparent)",
  background: "color-mix(in srgb, var(--lg-success) 10%, transparent)",
  color: "var(--lg-success)",
}

// ─── 字段卡片 ─────────────────────────────────────────────────────────────────

function FieldHeader({ icon, field }: { icon: ReactNode; field: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: "var(--lg-primary-light)" }}>{icon}</span>
      <span
        className="text-sm font-semibold"
        style={{ color: "var(--lg-text-primary)" }}
      >
        {field}
      </span>
    </div>
  )
}

/** 1) 标量对比 */
function ScalarDiff({ row }: { row: AuditChangeRow }) {
  return (
    <div className="space-y-2 py-3 first:pt-0 last:pb-0">
      <FieldHeader icon={<FileText className="size-4" />} field={row.field} />
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
        <div
          className="flex min-w-0 flex-col gap-1 rounded-xl border p-3"
          style={BEFORE_BOX_STYLE}
        >
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--lg-danger)" }}
          >
            变更前
          </span>
          <span
            className="text-sm break-all"
            style={{ color: "var(--lg-text-primary)" }}
          >
            {formatValue(row.before)}
          </span>
        </div>
        <ArrowRight
          className="mx-auto size-4 rotate-90 sm:rotate-0"
          style={{ color: "var(--lg-text-muted)" }}
        />
        <div
          className="flex min-w-0 flex-col gap-1 rounded-xl border p-3"
          style={AFTER_BOX_STYLE}
        >
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--lg-success)" }}
          >
            变更后
          </span>
          <span
            className="text-sm font-medium break-all"
            style={{ color: "var(--lg-text-primary)" }}
          >
            {formatValue(row.after)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** 2) 标签数组对比 */
function TagArrayDiff({ row }: { row: AuditChangeRow }) {
  const beforeTags = isTagArray(row.before) ? row.before.map(String) : []
  const afterTags = isTagArray(row.after) ? row.after.map(String) : []
  const added = afterTags.filter((tag) => !beforeTags.includes(tag))
  const deleted = beforeTags.filter((tag) => !afterTags.includes(tag))
  const unchanged = afterTags.filter((tag) => beforeTags.includes(tag))

  const hasChanges = added.length > 0 || deleted.length > 0

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <FieldHeader icon={<Tags className="size-4" />} field={row.field} />
      <div className="flex flex-wrap gap-2 pl-1">
        {deleted.map((tag) => (
          <span
            key={`deleted-${tag}`}
            className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium line-through opacity-80"
            style={DELETED_TAG_STYLE}
          >
            {tag}
          </span>
        ))}
        {unchanged.map((tag) => (
          <span
            key={`unchanged-${tag}`}
            className="inset-card inline-flex items-center rounded-lg px-2.5 py-1 text-xs"
            style={{ color: "var(--lg-text-secondary)" }}
          >
            {tag}
          </span>
        ))}
        {added.map((tag) => (
          <span
            key={`added-${tag}`}
            className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium"
            style={ADDED_TAG_STYLE}
          >
            + {tag}
          </span>
        ))}
        {!hasChanges && unchanged.length === 0 && (
          <span className="text-xs" style={{ color: "var(--lg-text-muted)" }}>
            —
          </span>
        )}
      </div>
    </div>
  )
}

/** 3) 键值对象对比 */
function ObjectDiff({ row }: { row: AuditChangeRow }) {
  const beforeObj = isPlainObject(row.before) ? row.before : {}
  const afterObj = isPlainObject(row.after) ? row.after : {}
  const keys = Array.from(
    new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])
  )

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <FieldHeader icon={<Braces className="size-4" />} field={row.field} />
      <div className="grid grid-cols-1 gap-2 pl-1 sm:grid-cols-2">
        {keys.map((key) => {
          const beforeValue = beforeObj[key]
          const afterValue = afterObj[key]
          const isChanged = formatValue(beforeValue) !== formatValue(afterValue)
          if (!isChanged) {
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--lg-border-subtle)] p-2.5 text-xs"
              >
                <span style={{ color: "var(--lg-text-muted)" }}>{key}</span>
                <span
                  className="truncate font-medium"
                  style={{ color: "var(--lg-text-primary)" }}
                >
                  {formatValue(afterValue)}
                </span>
              </div>
            )
          }
          return (
            <div
              key={key}
              className="flex flex-col gap-1 rounded-xl border p-3 text-xs sm:col-span-2"
              style={MODIFIED_ROW_STYLE}
            >
              <span
                className="text-[11px] font-semibold"
                style={{ color: "var(--lg-warning)" }}
              >
                {key}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="line-through opacity-70"
                  style={{ color: "var(--lg-danger)" }}
                >
                  {formatValue(beforeValue)}
                </span>
                <ArrowRight
                  className="size-3"
                  style={{ color: "var(--lg-text-muted)" }}
                />
                <span
                  className="font-medium"
                  style={{ color: "var(--lg-text-primary)" }}
                >
                  {formatValue(afterValue)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 对外组件 ─────────────────────────────────────────────────────────────────

export interface AuditDiffViewerProps {
  changes?: AuditChanges | null
  /** 无变更时的兜底文案 */
  emptyText?: string
  className?: string
}

export function AuditDiffViewer({
  changes,
  emptyText = "本次操作没有字段变更",
  className,
}: AuditDiffViewerProps) {
  const rows = useMemo(() => toChangeRows(changes), [changes])

  if (rows.length === 0) {
    return (
      <p
        className={cn("text-sm", className)}
        style={{ color: "var(--lg-text-muted)" }}
      >
        {emptyText}
      </p>
    )
  }

  return (
    <div className={cn("divide-y divide-[var(--lg-border-subtle)]", className)}>
      {rows.map((row) => {
        const mode = detectMode(row)
        if (mode === "tags") return <TagArrayDiff key={row.field} row={row} />
        if (mode === "object") return <ObjectDiff key={row.field} row={row} />
        return <ScalarDiff key={row.field} row={row} />
      })}
    </div>
  )
}

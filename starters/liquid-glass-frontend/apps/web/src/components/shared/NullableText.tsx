/**
 * NullableText — 统一可空文本原语组件
 *
 * 当传入的 value 为空（null / undefined / "" / 纯空格）时：
 * 自动强制使用 standard 字号 text-sm、标准字型 font-normal 及 var(--lg-text-muted) 淡灰色渲染标准破折号 —
 *
 * 当有值时：
 * 渲染 children 或 String(value)，透传自定义传入的 className（如 font-mono text-xs）与 style
 */
import * as React from "react"

import { EMPTY_VALUE } from "@/lib/format"

export interface NullableTextProps {
  /** 目标判定值 */
  value?: unknown
  /** 有值时的自定义渲染节点；若不传则渲染 String(value) */
  children?: React.ReactNode
  /** 有值时的 CSS 类名（如 font-mono text-xs）；空值时强制替换为 text-sm font-normal */
  className?: string
  /** 扩展样式 */
  style?: React.CSSProperties
  /** 自定义占位符，默认破折号 — */
  fallback?: string
}

export function NullableText({
  value,
  children,
  className,
  style,
  fallback = EMPTY_VALUE,
}: NullableTextProps) {
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())

  if (isEmpty) {
    return (
      <span
        className="text-sm font-normal"
        style={{ color: "var(--lg-text-muted)", ...style }}
      >
        {fallback}
      </span>
    )
  }

  return (
    <span className={className} style={style}>
      {children ??
        (value !== undefined && value !== null ? String(value) : null)}
    </span>
  )
}

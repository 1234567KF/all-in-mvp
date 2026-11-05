import type { ReactNode } from "react"

interface DetailRowProps {
  icon?: ReactNode
  label: string
  value?: ReactNode
  /** 紧凑模式（用于列表行内详情） */
  compact?: boolean
}

export function DetailRow({ icon, label, value, compact }: DetailRowProps) {
  return (
    <div className={`flex flex-col ${compact ? "gap-0.5" : "gap-1"}`}>
      <span
        className={`flex items-center gap-1 ${compact ? "text-[11px]" : "text-xs"}`}
        style={{ color: "var(--lg-text-muted)" }}
      >
        {icon}
        {label}
      </span>
      <span
        className={`${compact ? "text-xs" : "text-sm"} font-medium`}
        style={{ color: "var(--lg-text-primary)" }}
      >
        {value ?? "-"}
      </span>
    </div>
  )
}

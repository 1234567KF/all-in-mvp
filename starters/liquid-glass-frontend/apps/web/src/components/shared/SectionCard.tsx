/**
 * SectionCard — 详情分组卡片（圆角边框卡 + 小节标题）
 * 详情弹窗与详情面板等详情类视图共用的分组容器。
 */
import type { ReactNode } from "react"

export function SectionCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="inset-card p-4">
      <span
        className="mb-3 block text-[11px] font-semibold tracking-wide"
        style={{ color: "var(--lg-text-muted)" }}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

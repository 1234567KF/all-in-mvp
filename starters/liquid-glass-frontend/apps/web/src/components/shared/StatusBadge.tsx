import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  /** 实体是否处于启用/有效态，决定 badge-active / badge-inactive 样式 */
  active: boolean
}

/**
 * StatusBadge — 启用/停用状态徽章
 *
 * 收敛全站 `status === "active" ? "badge-active" : "badge-inactive"` 三元重复。
 * label 文案由调用方通过 children 传入（各模块的 *_LABELS 映射留在页面层）。
 */
function StatusBadge({ active, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant="default"
      className={cn(active ? "badge-active" : "badge-inactive", className)}
      {...props}
    />
  )
}

export { StatusBadge, type StatusBadgeProps }

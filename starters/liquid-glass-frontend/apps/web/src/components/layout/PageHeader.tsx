/**
 * PageHeader — 页面头部组件
 *
 * 来源：提取自 frontend/src/pages/UserData.tsx L231-244
 * 及其他所有页面的统一头部模式（MemberManagement、AuditLogs 等）
 *
 * 结构：左侧标题+描述，右侧可选操作区
 */

import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** 页面标题 */
  title: string
  /** 页面描述（显示在标题下方） */
  description?: string
  /** 右侧操作区（按钮等） */
  actions?: React.ReactNode
  /** 外层容器自定义 className */
  className?: string
}

function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div>
        <h1 className="font-heading text-[32px] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}

export { PageHeader, type PageHeaderProps }

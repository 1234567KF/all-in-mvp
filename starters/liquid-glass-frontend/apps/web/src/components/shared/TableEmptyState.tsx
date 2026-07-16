/**
 * TableEmptyState — 表格空状态组件
 *
 * 来源：提取自 frontend/src/pages/UserData.tsx L269-273
 * 及其他 10+ 处内联空状态模式（MemberManagement、AuditLogs 等）
 *
 * 结构：TableRow > TableCell(colSpan) > Empty 组件体系
 */

import * as React from "react"

import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface TableEmptyStateProps {
  /** 图标（推荐使用 lucide-react 图标，会自动加 size-12 + muted 样式） */
  icon?: React.ReactNode
  /** 空状态标题 */
  title: string
  /** 空状态描述文字 */
  description?: string
  /** 表格列数，用于 colSpan（默认 1） */
  colSpan?: number
  /** 自定义 className（加在 Empty 容器上） */
  className?: string
}

function TableEmptyState({
  icon,
  title,
  description,
  colSpan = 1,
  className,
}: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <Empty className={cn("border-0 py-16", className)}>
          {icon && (
            <EmptyMedia className="mb-4 size-12 text-muted-foreground/30">
              {icon}
            </EmptyMedia>
          )}
          <EmptyTitle className="font-heading text-base font-semibold">
            {title}
          </EmptyTitle>
          {description && (
            <EmptyDescription className="mt-1">{description}</EmptyDescription>
          )}
        </Empty>
      </TableCell>
    </TableRow>
  )
}

export { TableEmptyState, type TableEmptyStateProps }

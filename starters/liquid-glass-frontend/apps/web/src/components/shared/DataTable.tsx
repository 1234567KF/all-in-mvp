/**
 * DataTable — 声明式增强表格组件
 *
 * 整合 Card 容器 + 标准 Header 样式 + TableSkeleton + TableEmptyState + SmartPagination
 * 泛型实现，支持任意数据类型
 */

import * as React from "react"

import { SmartPagination } from "@/components/shared/SmartPagination"
import { TableEmptyState } from "@/components/shared/TableEmptyState"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface ColumnDef<T> {
  header: string
  accessor?: keyof T | ((row: T) => React.ReactNode)
  className?: string
  headerClassName?: string

  /** 自定义单元格渲染，优先于 accessor */
  render?: (row: T, index: number) => React.ReactNode
  /** 冻结列，透传给 TableHead/TableCell */
  frozen?: "left" | "right"
  /** 列宽类名，e.g. "w-[160px] max-w-[160px]" */
  width?: string
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  skeletonRows?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ComponentType<{ className?: string }>
  toolbar?: React.ReactNode
  total?: number
  pagination?: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  tableClassName?: string
  className?: string
  /** 用于生成行 key 的字段名或函数 */
  rowKey?: keyof T | ((row: T, index: number) => string | number)
  /** 行点击回调 */
  onRowClick?: (row: T, index: number) => void
  /** 行级样式类名 */
  rowClassName?: string | ((row: T, index: number) => string)
}

function getCellValue<T>(
  row: T,
  accessor: NonNullable<ColumnDef<T>["accessor"]>
): React.ReactNode {
  if (typeof accessor === "function") return accessor(row)
  return row[accessor] as React.ReactNode
}

function getRowKey<T>(
  row: T,
  index: number,
  rowKey?: DataTableProps<T>["rowKey"]
): string | number {
  if (!rowKey) return index
  if (typeof rowKey === "function") return rowKey(row, index)
  return row[rowKey] as string | number
}

function DataTableInner<T>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "暂无数据",
  emptyDescription,
  emptyIcon: EmptyIcon,
  toolbar,
  total,
  pagination,
  tableClassName,
  className,
  rowKey,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const showEmpty = !loading && data.length === 0
  const hasPagination = !!(pagination && pagination.totalPages > 1)
  const showHeader = !!(toolbar || (!hasPagination && total != null))

  return (
    <Card
      className={cn("glass-card gap-0 overflow-hidden p-0 py-0", className)}
    >
      {showHeader && (
        <div className="relative z-10 flex flex-row items-center justify-between border-b border-border/30 bg-muted/40 px-6 py-3">
          {toolbar || <div />}
          {!hasPagination && total != null && (
            <span className="font-mono text-xs text-muted-foreground">
              共 {total} 条记录
            </span>
          )}
        </div>
      )}

      <Table className={tableClassName}>
        <TableHeader>
          <TableRow className="bg-muted/30 backdrop-blur-md hover:bg-muted/30">
            {columns.map((col, i) => (
              <TableHead
                key={i}
                frozen={col.frozen}
                className={cn("data-label", col.width, col.headerClassName)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeleton
              rows={skeletonRows}
              columnClasses={columns.map((col) => col.className)}
            />
          ) : showEmpty ? (
            <TableEmptyState
              icon={EmptyIcon ? <EmptyIcon className="size-12" /> : undefined}
              title={emptyTitle}
              description={emptyDescription}
              colSpan={columns.length}
            />
          ) : (
            data.map((row, idx) => (
              <TableRow
                key={getRowKey(row, idx, rowKey)}
                className={cn(
                  "group/row border-b-[var(--lg-border-subtle)] transition-colors hover:bg-accent/30",
                  typeof rowClassName === "function"
                    ? rowClassName(row, idx)
                    : rowClassName
                )}
                onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={colIdx}
                    frozen={col.frozen}
                    className={cn(col.width, col.className)}
                  >
                    {col.render
                      ? col.render(row, idx)
                      : getCellValue(row, col.accessor!)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasPagination && !showEmpty && (
        <div
          className="relative z-10 flex items-center justify-between border-t bg-muted/30 px-6 py-4"
          style={{ borderColor: "var(--lg-border-subtle)" }}
        >
          {total != null && (
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
          )}
          <div className={total != null ? "ml-auto" : "mx-auto"}>
            <SmartPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.onPageChange}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * React.memo 包装：跳过 props 未变化时的重渲染。
 * 通过泛型断言保留原始调用签名，外部 API 不变。
 */
export const DataTable = React.memo(DataTableInner) as typeof DataTableInner

/**
 * VirtualDataTable — 虚拟滚动大数据表格组件
 *
 * 基于 @tanstack/react-virtual 实现行虚拟化，适用于 1000+ 行大数据量场景。
 * 表头固定 (sticky)，表体虚拟滚动。
 */

import { useVirtualizer } from "@tanstack/react-virtual"
import * as React from "react"

import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface VirtualColumnDef<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  className?: string
  headerClassName?: string
  /** 列宽（CSS 值，如 "120px" "20%"） */
  width?: string
}

export interface VirtualDataTableProps<T> {
  data: T[]
  columns: VirtualColumnDef<T>[]
  /** 行高，默认 48px */
  rowHeight?: number
  /** 容器最大高度，默认 600px */
  maxHeight?: number
  className?: string
  onRowClick?: (row: T) => void
}

function getCellValue<T>(
  row: T,
  accessor: VirtualColumnDef<T>["accessor"]
): React.ReactNode {
  if (typeof accessor === "function") return accessor(row)
  return row[accessor] as React.ReactNode
}

function VirtualDataTableInner<T>(
  {
    data,
    columns,
    rowHeight = 48,
    maxHeight = 600,
    className,
    onRowClick,
  }: VirtualDataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const headerScrollRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  // 合并 external ref 和 local scrollContainerRef
  React.useImperativeHandle(
    ref,
    () => scrollContainerRef.current as HTMLDivElement
  )

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : totalSize

  // 同步表头与表体的水平滚动
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  return (
    <div
      className={cn(
        "glass-card flex w-full flex-col overflow-hidden rounded-lg border border-border/40",
        className
      )}
    >
      {/* 表头容器 (隐藏垂直滚动条，水平滚动与表体同步) */}
      <div
        ref={headerScrollRef}
        className="[scrollbar-width:none] overflow-x-auto overflow-y-scroll border-b border-border/40 bg-card/95 backdrop-blur-md [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
      >
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {columns.map((col, i) => (
              <col
                key={i}
                style={col.width ? { width: col.width } : undefined}
              />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  className={cn(
                    "data-label h-12 px-6 py-3 text-left align-middle font-medium whitespace-nowrap text-foreground",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </table>
      </div>

      {/* 表体容器 (支持滚动) */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-scroll"
        style={{ maxHeight: `${maxHeight}px` }}
        onScroll={handleScroll}
      >
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {columns.map((col, i) => (
              <col
                key={i}
                style={col.width ? { width: col.width } : undefined}
              />
            ))}
          </colgroup>
          <TableBody className="[&_tr:last-child_td]:border-b-0">
            {paddingTop > 0 && (
              <TableRow
                style={{ height: `${paddingTop}px` }}
                className="border-0 hover:bg-transparent"
              >
                <TableCell
                  colSpan={columns.length}
                  className="h-0 border-0 p-0"
                />
              </TableRow>
            )}
            {virtualRows.map((virtualRow) => {
              const row = data[virtualRow.index]
              if (!row) return null
              return (
                <TableRow
                  key={virtualRow.index}
                  data-index={virtualRow.index}
                  className={cn(
                    "transition-colors hover:bg-accent/20",
                    onRowClick && "cursor-pointer"
                  )}
                  style={{ height: `${virtualRow.size}px` }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col, colIdx) => (
                    <TableCell
                      key={colIdx}
                      className={cn(
                        "px-6 py-3 align-middle whitespace-nowrap",
                        col.className
                      )}
                    >
                      {getCellValue(row, col.accessor)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
            {paddingBottom > 0 && (
              <TableRow
                style={{ height: `${paddingBottom}px` }}
                className="border-0 hover:bg-transparent"
              >
                <TableCell
                  colSpan={columns.length}
                  className="h-0 border-0 p-0"
                />
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  )
}

// 使用 forwardRef 保持泛型
export const VirtualDataTable = React.forwardRef(VirtualDataTableInner) as <T>(
  props: VirtualDataTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement

export type { VirtualColumnDef as ColumnDef }

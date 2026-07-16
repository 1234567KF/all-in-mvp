/**
 * TableSkeleton — 表格骨架屏组件
 *
 * 来源：提取自 frontend/src/pages/UserData.tsx L262-267
 * 及其他表格加载态模式
 *
 * 结构：多行 TableRow > TableCell > Skeleton
 */

import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

interface TableSkeletonProps {
  /** 骨架行数（默认 5） */
  rows?: number
  /** 每行列数（默认 4） */
  columns?: number
  /** 每列的 class 类名，用于同步自适应显示/隐藏 */
  columnClasses?: (string | undefined)[]
}

function TableSkeleton({
  rows = 5,
  columns = 4,
  columnClasses,
}: TableSkeletonProps) {
  const cellCount = columnClasses ? columnClasses.length : columns
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx} className="hover:bg-transparent">
          {Array.from({ length: cellCount }).map((_, colIdx) => {
            const className = columnClasses?.[colIdx]
            return (
              <TableCell key={colIdx} className={className}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}

export { TableSkeleton, type TableSkeletonProps }

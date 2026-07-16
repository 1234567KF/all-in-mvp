// 提取自 frontend/src/pages/UserData.tsx (分页逻辑与 JSX)

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

export interface SmartPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * 生成页码列表（含省略号）
 * total <= 7 全显示，否则首尾 + 当前页前后 1 页 + 省略号
 */
function getPageNumbers(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (current > 3) pages.push("ellipsis")
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push("ellipsis")
  pages.push(total)
  return pages
}

export function SmartPagination({
  currentPage,
  totalPages,
  onPageChange,
}: SmartPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <Pagination className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(currentPage - 1)}
            className={cn(currentPage <= 1 && "pointer-events-none opacity-50")}
          />
        </PaginationItem>
        {getPageNumbers(currentPage, totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`e-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === currentPage}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(currentPage + 1)}
            className={cn(
              currentPage >= totalPages && "pointer-events-none opacity-50"
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

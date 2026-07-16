import { useMemo, useState } from "react"

export function usePagination<T>(data: T[], pageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.ceil(data.length / pageSize)

  // 数据变化（过滤/搜索）后自动限制到有效页
  const safePage = currentPage > totalPages && totalPages > 0 ? 1 : currentPage

  const paginatedData = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize]
  )

  return { currentPage: safePage, totalPages, paginatedData, setCurrentPage }
}

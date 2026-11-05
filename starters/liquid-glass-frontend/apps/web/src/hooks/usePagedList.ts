/**
 * usePagedList — 统一「过滤 + 排序 + 分页」的列表 hook
 * 替代各页面散落的 filter 链 + usePagination 组合。
 * 内部组合 usePagination 复用安全页回退逻辑，自身只负责过滤 + 排序。
 * 注意：filter/sort 需保持引用稳定（useCallback/useMemo 或组件外定义），
 * 否则每次渲染都会触发重算。
 */
import { useMemo } from "react"

import { usePagination } from "@/hooks/usePagination"

export interface UsePagedListOptions<T> {
  /** 过滤谓词，缺省不过滤 */
  filter?: (item: T) => boolean
  /** 排序比较器（过滤后应用，不修改原数组），缺省保持原序 */
  sort?: (a: T, b: T) => number
  /** 每页条数，默认 10 */
  pageSize?: number
}

export function usePagedList<T>(
  data: T[],
  options: UsePagedListOptions<T> = {}
) {
  const { filter, sort, pageSize = 10 } = options

  const processed = useMemo(() => {
    const filtered = filter ? data.filter(filter) : data
    return sort ? [...filtered].sort(sort) : filtered
  }, [data, filter, sort])

  const { currentPage, totalPages, paginatedData, setCurrentPage } =
    usePagination(processed, pageSize)

  return {
    /** 当前页数据 */
    items: paginatedData,
    /** 过滤后的总条数 */
    total: processed.length,
    currentPage,
    totalPages,
    setPage: setCurrentPage,
  }
}

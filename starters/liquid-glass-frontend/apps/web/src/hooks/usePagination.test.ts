import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { usePagination } from "@/hooks/usePagination"

const makeData = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe("usePagination", () => {
  it("空数据时返回空列表且 totalPages 为 0", () => {
    const { result } = renderHook(() => usePagination<number>([], 10))
    expect(result.current.paginatedData).toEqual([])
    expect(result.current.totalPages).toBe(0)
    expect(result.current.currentPage).toBe(1)
  })

  it("总数小于等于 pageSize 时只有 1 页", () => {
    const { result } = renderHook(() => usePagination(makeData(5), 10))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.paginatedData).toEqual([1, 2, 3, 4, 5])
  })

  it("总数等于 pageSize 时只有 1 页且数据完整", () => {
    const { result } = renderHook(() => usePagination(makeData(10), 10))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.paginatedData).toHaveLength(10)
  })

  it("多页时默认显示第一页", () => {
    const { result } = renderHook(() => usePagination(makeData(25), 10))
    expect(result.current.totalPages).toBe(3)
    expect(result.current.currentPage).toBe(1)
    expect(result.current.paginatedData).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it("setCurrentPage 切换到中间页", () => {
    const { result } = renderHook(() => usePagination(makeData(30), 10))
    act(() => {
      result.current.setCurrentPage(2)
    })
    expect(result.current.currentPage).toBe(2)
    expect(result.current.paginatedData).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
  })

  it("setCurrentPage 切换到最后一页", () => {
    const { result } = renderHook(() => usePagination(makeData(25), 10))
    act(() => {
      result.current.setCurrentPage(3)
    })
    expect(result.current.currentPage).toBe(3)
    expect(result.current.paginatedData).toEqual([21, 22, 23, 24, 25])
  })

  it("currentPage 超出 totalPages 时自动回退到第 1 页", () => {
    // 先切到第 3 页，再让数据缩短使 totalPages 变为 1
    const { result, rerender } = renderHook(
      ({ data }) => usePagination(data, 10),
      { initialProps: { data: makeData(25) } }
    )
    act(() => {
      result.current.setCurrentPage(3)
    })
    expect(result.current.currentPage).toBe(3)

    // 数据缩短为 8 条，totalPages=1，safePage 应回退到 1
    rerender({ data: makeData(8) })
    expect(result.current.currentPage).toBe(1)
    expect(result.current.paginatedData).toHaveLength(8)
  })

  it("totalPages 为 0 时 safePage 不重置（保持 currentPage 不变）", () => {
    // totalPages=0 时 safePage 条件 totalPages > 0 不满足，currentPage 保持原值
    const { result } = renderHook(() => usePagination<number>([], 10))
    // currentPage 初始为 1，totalPages=0，safePage=1（因为 totalPages 不大于 0）
    expect(result.current.currentPage).toBe(1)
  })

  it("自定义 pageSize 生效", () => {
    const { result } = renderHook(() => usePagination(makeData(20), 5))
    expect(result.current.totalPages).toBe(4)
    expect(result.current.paginatedData).toHaveLength(5)
    expect(result.current.paginatedData).toEqual([1, 2, 3, 4, 5])
  })
})

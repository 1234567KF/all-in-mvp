/**
 * usePagedList 单测 — 过滤/排序/分页组合行为与安全页回退
 */
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { usePagedList } from "@/hooks/usePagedList"

const makeData = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe("usePagedList", () => {
  it("无选项时按默认 pageSize=10 分页", () => {
    const { result } = renderHook(() => usePagedList(makeData(25)))

    expect(result.current.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result.current.total).toBe(25)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.currentPage).toBe(1)
  })

  it("filter 生效且 total 为过滤后条数", () => {
    const isEven = (n: number) => n % 2 === 0
    const { result } = renderHook(() =>
      usePagedList(makeData(30), { filter: isEven, pageSize: 5 })
    )

    expect(result.current.items).toEqual([2, 4, 6, 8, 10])
    expect(result.current.total).toBe(15)
    expect(result.current.totalPages).toBe(3)
  })

  it("sort 生效且不修改原数组", () => {
    const data = [3, 1, 2]
    const desc = (a: number, b: number) => b - a
    const { result } = renderHook(() => usePagedList(data, { sort: desc }))

    expect(result.current.items).toEqual([3, 2, 1])
    expect(data).toEqual([3, 1, 2])
  })

  it("filter + sort + 翻页组合", () => {
    const isOdd = (n: number) => n % 2 === 1
    const desc = (a: number, b: number) => b - a
    const { result } = renderHook(() =>
      usePagedList(makeData(20), { filter: isOdd, sort: desc, pageSize: 3 })
    )

    expect(result.current.items).toEqual([19, 17, 15])

    act(() => {
      result.current.setPage(2)
    })
    expect(result.current.currentPage).toBe(2)
    expect(result.current.items).toEqual([13, 11, 9])
  })

  it("数据缩减导致当前页越界时回退到第 1 页", () => {
    const { result, rerender } = renderHook(
      ({ data }) => usePagedList(data, { pageSize: 10 }),
      { initialProps: { data: makeData(30) } }
    )

    act(() => {
      result.current.setPage(3)
    })
    expect(result.current.currentPage).toBe(3)

    rerender({ data: makeData(5) })
    expect(result.current.currentPage).toBe(1)
    expect(result.current.items).toEqual([1, 2, 3, 4, 5])
  })

  it("空数据时 items 为空且 totalPages 为 0", () => {
    const { result } = renderHook(() => usePagedList([] as number[]))

    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.totalPages).toBe(0)
    expect(result.current.currentPage).toBe(1)
  })

  it("数据清空（totalPages=0）时页码回退到第 1 页", () => {
    const { result, rerender } = renderHook(
      ({ data }) => usePagedList(data, { pageSize: 10 }),
      { initialProps: { data: makeData(30) } }
    )

    act(() => {
      result.current.setPage(3)
    })
    expect(result.current.currentPage).toBe(3)

    rerender({ data: [] as number[] })
    expect(result.current.currentPage).toBe(1)
    expect(result.current.items).toEqual([])
    expect(result.current.totalPages).toBe(0)
  })
})

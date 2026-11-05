import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useIsMobile } from "@/hooks/use-mobile"

type MqlListener = ((e: MediaQueryListEvent) => void) | null

/** 辅助：模拟 window.innerWidth 并触发 matchMedia 监听器 */
function setViewportWidth(width: number, listeners: Set<MqlListener>) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  })
  const event = { matches: width < 768 } as MediaQueryListEvent
  listeners.forEach((fn) => fn?.(event))
}

describe("useIsMobile", () => {
  let listeners: Set<MqlListener>

  beforeEach(() => {
    listeners = new Set()
    vi.spyOn(window, "matchMedia").mockImplementation((_query) => {
      return {
        addEventListener: (_type: string, fn: MqlListener) => {
          listeners.add(fn)
        },
        removeEventListener: (_type: string, fn: MqlListener) => {
          listeners.delete(fn)
        },
      } as unknown as MediaQueryList
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("宽度小于 768 时返回 true", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 500,
      configurable: true,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("宽度大于等于 768 时返回 false", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("宽度等于 768 边界值时返回 false（不小于 768）", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 768,
      configurable: true,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("宽度从桌面缩至移动端时更新为 true", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => setViewportWidth(500, listeners))
    expect(result.current).toBe(true)
  })

  it("宽度从移动端扩至桌面时更新为 false", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 500,
      configurable: true,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => setViewportWidth(1200, listeners))
    expect(result.current).toBe(false)
  })

  it("卸载时移除 matchMedia 监听器", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
    })
    const { unmount } = renderHook(() => useIsMobile())
    expect(listeners.size).toBe(1)

    unmount()
    expect(listeners.size).toBe(0)
  })
})

import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider, useTheme } from "@/components/providers/theme-provider"
import { THEME_COLOR_STORAGE_KEY } from "@/lib/theme-colors"

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" disableTransitionOnChange={false}>
      {children}
    </ThemeProvider>
  )
}

function dispatchStorageEvent(key: string | null, newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue,
      storageArea: localStorage,
    })
  )
}

describe("ThemeProvider theme color", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
    localStorage.clear()
    document.documentElement.removeAttribute("data-theme-color")
    document.documentElement.classList.remove("light", "dark")
  })

  it("applies the default theme color on mount", () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.themeColor).toBe("green")
    expect(document.documentElement.dataset.themeColor).toBe("green")
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBeNull()
  })

  it("persists and applies a selected theme color", () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setThemeColor("blue")
    })

    expect(result.current.themeColor).toBe("blue")
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe("blue")
    expect(document.documentElement.dataset.themeColor).toBe("blue")
  })

  it("restores a stored color and falls back for invalid values", () => {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, "rose")
    const first = renderHook(() => useTheme(), { wrapper })

    expect(first.result.current.themeColor).toBe("rose")
    expect(document.documentElement.dataset.themeColor).toBe("rose")

    cleanup()
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, "magenta")

    const second = renderHook(() => useTheme(), { wrapper })

    expect(second.result.current.themeColor).toBe("green")
    expect(document.documentElement.dataset.themeColor).toBe("green")
  })

  it("syncs from another tab and falls back when the key is removed", () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      dispatchStorageEvent(THEME_COLOR_STORAGE_KEY, "purple")
    })

    expect(result.current.themeColor).toBe("purple")
    expect(document.documentElement.dataset.themeColor).toBe("purple")

    act(() => {
      dispatchStorageEvent(THEME_COLOR_STORAGE_KEY, null)
    })

    expect(result.current.themeColor).toBe("green")
  })

  it("resets both preferences when another tab clears localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme("light")
      result.current.setThemeColor("blue")
    })

    act(() => {
      dispatchStorageEvent(null, null)
    })

    expect(result.current.theme).toBe("dark")
    expect(result.current.themeColor).toBe("green")
  })

  it("keeps the selection in memory when localStorage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked")
    })

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setThemeColor("rose")
    })

    expect(result.current.themeColor).toBe("rose")
    expect(document.documentElement.dataset.themeColor).toBe("rose")
  })
})

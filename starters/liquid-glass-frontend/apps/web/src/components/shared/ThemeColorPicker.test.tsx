import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/providers/theme-provider"
import { ThemeColorPicker } from "@/components/shared/ThemeColorPicker"
import { THEME_COLOR_STORAGE_KEY, THEME_COLORS } from "@/lib/theme-colors"

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" disableTransitionOnChange={false}>
      {children}
    </ThemeProvider>
  )
}

describe("ThemeColorPicker", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.removeAttribute("data-theme-color")
    document.documentElement.classList.remove("light", "dark")
  })

  it.each([false, true])(
    "renders one accessible option per theme color (showLabels=%s)",
    (showLabels) => {
      render(<ThemeColorPicker showLabels={showLabels} />, { wrapper })

      for (const color of THEME_COLORS) {
        expect(
          screen.getByRole("radio", { name: color.label })
        ).toBeInTheDocument()
      }

      expect(screen.getAllByRole("radio")).toHaveLength(THEME_COLORS.length)

      if (showLabels) {
        for (const color of THEME_COLORS) {
          expect(screen.getByText(color.label)).toBeVisible()
        }
      }
    }
  )

  it("applies the clicked color and marks it as selected", () => {
    render(<ThemeColorPicker />, { wrapper })

    const blue = screen.getByRole("radio", { name: "科技蓝" })
    fireEvent.click(blue)

    expect(document.documentElement.dataset.themeColor).toBe("blue")
    expect(blue).toHaveAttribute("data-state", "on")
    expect(blue).toHaveAttribute("aria-checked", "true")
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe("blue")

    const green = screen.getByRole("radio", { name: "翡翠绿" })
    expect(green).toHaveAttribute("data-state", "off")
  })

  it("keeps the current color when the selected item is clicked again", () => {
    render(<ThemeColorPicker />, { wrapper })

    const blue = screen.getByRole("radio", { name: "科技蓝" })
    fireEvent.click(blue)
    fireEvent.click(blue)

    expect(document.documentElement.dataset.themeColor).toBe("blue")
    expect(blue).toHaveAttribute("data-state", "on")
    expect(blue).toHaveAttribute("aria-checked", "true")
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe("blue")
  })
})

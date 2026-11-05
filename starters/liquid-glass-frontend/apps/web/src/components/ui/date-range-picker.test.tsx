import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DateRangePicker } from "@/components/ui/date-range-picker"

const from = new Date(2026, 9, 5)
const to = new Date(2026, 10, 4)

describe("DateRangePicker", () => {
  afterEach(() => cleanup())

  it("renders the full Chinese range without abbreviation", () => {
    render(
      <DateRangePicker dateRange={{ from, to }} onDateRangeChange={() => {}} />
    )

    const trigger = screen.getByRole("button", { name: /2026年10月05日/ })

    expect(trigger).toHaveTextContent("2026年10月05日 — 2026年11月04日")
    expect(trigger).not.toHaveTextContent("2026-10-05")
  })

  it("renders a single Chinese date when only from is selected", () => {
    render(
      <DateRangePicker dateRange={{ from }} onDateRangeChange={() => {}} />
    )

    const trigger = screen.getByRole("button", { name: /2026年10月05日/ })

    expect(trigger).toHaveTextContent("2026年10月05日")
  })

  it("renders the placeholder when empty", () => {
    render(
      <DateRangePicker dateRange={undefined} onDateRangeChange={() => {}} />
    )

    expect(
      screen.getByRole("button", { name: "选择日期范围" })
    ).toBeInTheDocument()
  })

  it("clears the range without opening the popover", () => {
    const onDateRangeChange = vi.fn()
    render(
      <DateRangePicker
        dateRange={{ from, to }}
        onDateRangeChange={onDateRangeChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "清除日期" }))

    expect(onDateRangeChange).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

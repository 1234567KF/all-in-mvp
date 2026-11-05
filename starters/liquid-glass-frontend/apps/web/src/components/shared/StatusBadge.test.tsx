/**
 * StatusBadge 单元测试
 * 覆盖：active/inactive 两分支类名、children 渲染、className 合并
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "@/components/shared/StatusBadge"

describe("StatusBadge", () => {
  it("active=true 时应用 badge-active 类", () => {
    render(<StatusBadge active>启用</StatusBadge>)
    const el = screen.getByText("启用")
    expect(el.className).toContain("badge-active")
    expect(el.className).not.toContain("badge-inactive")
  })

  it("active=false 时应用 badge-inactive 类", () => {
    render(<StatusBadge active={false}>停用</StatusBadge>)
    const el = screen.getByText("停用")
    expect(el.className).toContain("badge-inactive")
    expect(el.className).not.toContain("badge-active")
  })

  it("合并自定义 className 并渲染 children", () => {
    render(
      <StatusBadge active className="extra-cls" data-testid="badge">
        状态文案
      </StatusBadge>
    )
    const el = screen.getByTestId("badge")
    expect(el.className).toContain("badge-active")
    expect(el.className).toContain("extra-cls")
    expect(el.textContent).toBe("状态文案")
  })
})

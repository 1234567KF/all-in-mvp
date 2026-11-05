/**
 * ResponsiveDialog 单元测试
 * 覆盖：桌面渲染居中 Dialog / 移动渲染底部 Sheet 的结构性分叉、
 * Footer 移动端吸底样式、关闭按钮 after: 伪元素扩命中区
 */
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/shared/ResponsiveDialog"

const { isMobileMock } = vi.hoisted(() => ({
  isMobileMock: vi.fn(() => false),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: isMobileMock }))

function renderDialog() {
  return render(
    <ResponsiveDialog open onOpenChange={() => {}}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>测试标题</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div>正文内容</div>
        <ResponsiveDialogFooter>
          <button>取消</button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

describe("ResponsiveDialog", () => {
  afterEach(() => {
    isMobileMock.mockReturnValue(false)
  })

  it("桌面端渲染居中 Dialog（dialog-content），不渲染 Sheet", () => {
    renderDialog()
    expect(
      document.querySelector('[data-slot="dialog-content"]')
    ).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="sheet-content"]')
    ).not.toBeInTheDocument()
    expect(screen.getByText("测试标题")).toBeInTheDocument()
    expect(screen.getByText("正文内容")).toBeInTheDocument()
  })

  it("移动端渲染底部 Sheet（sheet-content side=bottom），不渲染 Dialog", () => {
    isMobileMock.mockReturnValue(true)
    renderDialog()
    const sheet = document.querySelector('[data-slot="sheet-content"]')
    expect(sheet).toBeInTheDocument()
    expect(sheet).toHaveAttribute("data-side", "bottom")
    expect(
      document.querySelector('[data-slot="dialog-content"]')
    ).not.toBeInTheDocument()
    expect(screen.getByText("测试标题")).toBeInTheDocument()
    expect(screen.getByText("正文内容")).toBeInTheDocument()
  })

  it("移动端 Footer 带 sticky 吸底样式，桌面端不带", () => {
    const { unmount } = renderDialog()
    const desktopFooter = document.querySelector('[data-slot="dialog-footer"]')
    expect(desktopFooter?.className).not.toContain("sticky")
    unmount()

    isMobileMock.mockReturnValue(true)
    renderDialog()
    const mobileFooter = document.querySelector('[data-slot="dialog-footer"]')
    expect(mobileFooter?.className).toContain("sticky")
  })

  it("移动端关闭按钮保持 absolute 定位并用 after: 伪元素扩命中区", () => {
    isMobileMock.mockReturnValue(true)
    renderDialog()
    const closeBtn = document.querySelector('[data-slot="sheet-close"]')
    expect(closeBtn).toBeInTheDocument()
    // 定位元素禁用 .touch-hit（其 position:relative 会覆盖 absolute）
    expect(closeBtn?.className).not.toContain("touch-hit")
    expect(closeBtn?.className).toContain("absolute")
    // after: 扩命中区经 pointer-coarse 门控，与 ui/dialog、ui/sheet 对齐
    expect(closeBtn?.className).toContain("pointer-coarse:after:-inset-2")
  })
})

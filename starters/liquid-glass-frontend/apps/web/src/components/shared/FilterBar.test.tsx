/**
 * FilterBar 单元测试
 * 覆盖：纯布局容器、labels 包裹、空标签跳过、自定义 className、
 * 移动端筛选收纳（search 保留在外、筛选按钮 badge、抽屉收纳 children）
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FilterBar } from "@/components/shared/FilterBar"

// 可控的 useIsMobile mock（默认桌面端，移动分支用例内改为 true）
const { isMobileMock } = vi.hoisted(() => ({
  isMobileMock: vi.fn(() => false),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: isMobileMock }))

afterEach(() => {
  isMobileMock.mockReturnValue(false)
})

describe("FilterBar", () => {
  it("默认作为纯布局容器渲染子元素", () => {
    render(
      <FilterBar>
        <input placeholder="搜索名称" />
        <button>查询</button>
      </FilterBar>
    )
    expect(screen.getByPlaceholderText("搜索名称")).toBeInTheDocument()
    expect(screen.getByText("查询")).toBeInTheDocument()
    // 无 labels 时不渲染任何标签
    expect(screen.queryByText("名称")).not.toBeInTheDocument()
  })

  it("传入 labels 时为对应子元素包裹标签", () => {
    render(
      <FilterBar labels={["状态", "类型"]}>
        <select aria-label="状态筛选" data-testid="status" />
        <select aria-label="类型筛选" data-testid="type" />
      </FilterBar>
    )
    expect(screen.getByText("状态")).toBeInTheDocument()
    expect(screen.getByText("类型")).toBeInTheDocument()
    // 标签与控件同处一个包裹容器
    expect(
      screen
        .getByText("状态")
        .parentElement?.contains(screen.getByTestId("status"))
    ).toBe(true)
  })

  it("空字符串标签跳过包裹，仅渲染子元素", () => {
    const { container } = render(
      <FilterBar labels={["状态", ""]}>
        <select aria-label="状态筛选" data-testid="status" />
        <button>重置</button>
      </FilterBar>
    )
    expect(screen.getByText("重置")).toBeInTheDocument()
    // 仅"状态"被包裹，重置按钮无标签容器
    expect(container.querySelectorAll("label")).toHaveLength(1)
  })

  it("透传自定义 className 到容器", () => {
    const { container } = render(
      <FilterBar className="mb-4">
        <button>查询</button>
      </FilterBar>
    )
    expect((container.firstChild as HTMLElement).className).toContain("mb-4")
    expect((container.firstChild as HTMLElement).className).toContain("flex")
  })

  it("桌面端 search 插槽排在 children 之前且无筛选按钮", () => {
    render(
      <FilterBar search={<input placeholder="搜索名称" />}>
        <select aria-label="状态筛选" />
      </FilterBar>
    )
    expect(screen.getByPlaceholderText("搜索名称")).toBeInTheDocument()
    expect(screen.queryByText("筛选")).not.toBeInTheDocument()
  })

  describe("移动端收纳", () => {
    it("search 保留在外，children 收进抽屉，点筛选按钮后可见", () => {
      isMobileMock.mockReturnValue(true)
      render(
        <FilterBar
          search={<input placeholder="搜索名称" />}
          sheetLabels={["状态"]}
        >
          <select aria-label="状态筛选" />
        </FilterBar>
      )
      // search 在抽屉外直接可见；筛选控件收进抽屉未渲染
      expect(screen.getByPlaceholderText("搜索名称")).toBeInTheDocument()
      expect(screen.queryByLabelText("状态筛选")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: /筛选/ }))
      // 抽屉打开后：控件与 sheetLabels 标签均可见
      expect(screen.getByLabelText("状态筛选")).toBeInTheDocument()
      expect(screen.getByText("状态")).toBeInTheDocument()
      // 点"完成"关闭抽屉
      fireEvent.click(screen.getByRole("button", { name: "完成" }))
      expect(screen.queryByLabelText("状态筛选")).not.toBeInTheDocument()
    })

    it("activeFilterCount > 0 时筛选按钮显示 badge", () => {
      isMobileMock.mockReturnValue(true)
      render(
        <FilterBar activeFilterCount={3}>
          <select aria-label="状态筛选" />
        </FilterBar>
      )
      expect(screen.getByRole("button", { name: /筛选/ })).toHaveTextContent(
        "3"
      )
    })

    it("activeFilterCount 为 0 时不显示 badge", () => {
      isMobileMock.mockReturnValue(true)
      const { container } = render(
        <FilterBar activeFilterCount={0}>
          <select aria-label="状态筛选" />
        </FilterBar>
      )
      expect(
        container.querySelector('[data-slot="badge"]')
      ).not.toBeInTheDocument()
    })

    it("无 children 时仅渲染 search，不显示筛选按钮", () => {
      isMobileMock.mockReturnValue(true)
      render(<FilterBar search={<input placeholder="搜索名称" />} />)
      expect(screen.getByPlaceholderText("搜索名称")).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /筛选/ })
      ).not.toBeInTheDocument()
    })
  })
})

/**
 * MobileCard 组合原语单元测试
 * 覆盖：根容器 space-y-1、标题行 truncate span 与徽章插槽、
 * 标签行 / 元信息行结构类名、className 合并透传
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  MobileCard,
  MobileCardBody,
  MobileCardCompact,
  MobileCardFooter,
  MobileCardHeader,
  MobileCardMeta,
  MobileCardTags,
  MobileCardTitle,
} from "@/components/shared/MobileCard"

describe("MobileCard", () => {
  it("根容器渲染 space-y-1.5 并合并自定义 className", () => {
    const { container } = render(
      <MobileCard className="min-w-0 flex-1" data-testid="card">
        content
      </MobileCard>
    )
    const el = screen.getByTestId("card")
    expect(el.className).toContain("space-y-1.5")
    expect(el.className).toContain("min-w-0")
    expect(el.className).toContain("flex-1")
    expect(container.textContent).toBe("content")
  })
})

describe("MobileCardTitle", () => {
  it("渲染 truncate 标题 span 与跟随的徽章插槽", () => {
    render(
      <MobileCardTitle title="示例名称">
        <span data-testid="badge">启用</span>
      </MobileCardTitle>
    )
    const title = screen.getByText("示例名称")
    expect(title.tagName).toBe("SPAN")
    expect(title.className).toContain("truncate")
    expect(title.className).toContain("text-sm")
    expect(title.className).toContain("font-medium")
    expect(screen.getByTestId("badge")).toBeInTheDocument()
  })

  it("标题行容器合并自定义 className", () => {
    render(
      <MobileCardTitle
        title="x"
        className="justify-between"
        data-testid="row"
      />
    )
    const row = screen.getByTestId("row")
    expect(row.className).toContain("flex")
    expect(row.className).toContain("items-center")
    expect(row.className).toContain("justify-between")
  })
})

describe("MobileCardTags", () => {
  it("渲染 flex-wrap 容器并合并 className", () => {
    render(
      <MobileCardTags className="gap-3" data-testid="tags">
        <span>tag</span>
      </MobileCardTags>
    )
    const el = screen.getByTestId("tags")
    expect(el.className).toContain("flex-wrap")
    expect(el.className).toContain("gap-3")
    expect(screen.getByText("tag")).toBeInTheDocument()
  })
})

describe("MobileCardMeta", () => {
  it("渲染 mono 小字元信息行并合并 className", () => {
    render(
      <MobileCardMeta className="justify-end" data-testid="meta">
        <span>操作人</span>
      </MobileCardMeta>
    )
    const el = screen.getByTestId("meta")
    expect(el.className).toContain("font-mono")
    expect(el.className).toContain("text-[11px]")
    expect(el.className).toContain("justify-end")
    expect(screen.getByText("操作人")).toBeInTheDocument()
  })
})

describe("MobileCardHeader / Body / Footer 三段式原语", () => {
  it("MobileCardHeader 渲染 truncate 标题与 extra 徽章插槽", () => {
    render(
      <MobileCardHeader
        title="项目名称"
        extra={<span data-testid="extra">已通过</span>}
        data-testid="header"
      />
    )
    expect(screen.getByText("项目名称")).toBeInTheDocument()
    expect(screen.getByTestId("extra")).toBeInTheDocument()
    const header = screen.getByTestId("header")
    expect(header.className).toContain("justify-between")
  })

  it("MobileCardBody 渲染属性文本区域", () => {
    render(
      <MobileCardBody data-testid="body">
        <span>示例公司</span>
      </MobileCardBody>
    )
    const body = screen.getByTestId("body")
    expect(body.className).toContain("text-xs")
    expect(screen.getByText("示例公司")).toBeInTheDocument()
  })

  it("MobileCardFooter 渲染左侧标签与右侧动作组", () => {
    render(
      <MobileCardFooter
        left={<span>分类名</span>}
        actions={<button type="button">操作</button>}
        data-testid="footer"
      />
    )
    expect(screen.getByText("分类名")).toBeInTheDocument()
    expect(screen.getByText("操作")).toBeInTheDocument()
    const footer = screen.getByTestId("footer")
    expect(footer.className).toContain("text-xs")
  })

  it("MobileCardCompact 渲染极简单行卡片", () => {
    render(
      <MobileCardCompact
        title="分类A"
        extra={<span data-testid="badge">启用</span>}
        actions={<button type="button">操作</button>}
      />
    )
    expect(screen.getByText("分类A")).toBeInTheDocument()
    expect(screen.getByTestId("badge")).toBeInTheDocument()
    expect(screen.getByText("操作")).toBeInTheDocument()
  })
})

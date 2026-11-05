import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { NotificationContent } from "@/components/shared/NotificationContent"

describe("NotificationContent", () => {
  afterEach(() => cleanup())

  it("把「」包裹的整段实体渲染为 chip，其余正文保持原样", () => {
    render(<NotificationContent content="李四提交了「康泰医药」审批" />)

    expect(screen.getByText("康泰医药")).toBeInTheDocument()
    expect(screen.getByText(/李四提交了/)).toBeInTheDocument()
    expect(screen.getByText(/审批/)).toBeInTheDocument()
  })

  it("同时配置长短词时按长词优先匹配（「被驳回」不被拆成「被」+「驳回」）", () => {
    render(
      <NotificationContent
        content="您的申请被驳回"
        emphasis={[{ words: ["驳回", "被驳回"], tone: "danger" }]}
      />
    )

    // 长词整体匹配：文本节点仍是「被驳回」
    expect(screen.getByText("被驳回")).toBeInTheDocument()
    // 短词没有抢到匹配，否则只会剩下「被」+「驳回」两个节点
    expect(screen.queryByText("驳回")).not.toBeInTheDocument()
  })

  it("emphasis 词组按字面匹配，正则元字符会被转义", () => {
    render(
      <NotificationContent
        content="请复核 C++ (v2.0) 任务"
        emphasis={[{ words: ["C++ (v2.0)"], tone: "primary" }]}
      />
    )

    expect(screen.getByText("C++ (v2.0)")).toBeInTheDocument()
  })

  it("未闭合引号按普通文本渲染，不丢字符也不误判为 chip", () => {
    render(<NotificationContent content="已处理「A」「B" />)

    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("「B")).toBeInTheDocument()
  })

  it("同一 emphasis 词组重复出现时逐处高亮", () => {
    render(
      <NotificationContent
        content="请及时审核；再次提醒：请及时审核"
        emphasis={[{ words: ["请及时审核"], tone: "warning" }]}
      />
    )

    expect(screen.getAllByText("请及时审核")).toHaveLength(2)
  })

  it("emphasis 高亮引用 tone 的可读 token，不写死颜色", () => {
    render(
      <NotificationContent
        content="请及时审核"
        emphasis={[{ words: ["请及时审核"], tone: "warning" }]}
      />
    )

    expect(screen.getByText("请及时审核").getAttribute("style")).toContain(
      "var(--lg-warning-text)"
    )
  })

  it("空正文不产生任何内容", () => {
    const { container } = render(<NotificationContent content="" />)

    expect(container).toBeEmptyDOMElement()
  })
})

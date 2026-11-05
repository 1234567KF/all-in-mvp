import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { NotificationItem } from "@/components/shared/notification-config"
import { NotificationPanel } from "@/components/shared/NotificationPanel"

function createNotification(
  overrides: Partial<NotificationItem> &
    Pick<NotificationItem, "id" | "title" | "content">
): NotificationItem {
  const { id, title, content, ...rest } = overrides
  return {
    id,
    title,
    content,
    createdAt: "2026-07-26T10:00:00.000Z",
    read: false,
    type: "info",
    ...rest,
  }
}

describe("NotificationPanel", () => {
  afterEach(() => cleanup())

  it("渲染标题、未读角标与全部已读按钮", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "新的审批申请",
            content: "请及时审核",
          }),
        ]}
        onMarkAllRead={vi.fn()}
      />
    )

    expect(screen.getByText("消息通知")).toBeInTheDocument()
    expect(screen.getByText("全部已读")).toBeInTheDocument()
    expect(screen.getByText("1 条未读")).toBeInTheDocument()
  })

  it("点击全部已读触发 onMarkAllRead", () => {
    const onMarkAllRead = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "新的审批申请",
            content: "请及时审核",
          }),
        ]}
        onMarkAllRead={onMarkAllRead}
      />
    )

    fireEvent.click(screen.getByText("全部已读"))

    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it("没有未读时不显示全部已读按钮", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "已读消息",
            content: "无需处理",
            read: true,
          }),
        ]}
        onMarkAllRead={vi.fn()}
      />
    )

    expect(screen.queryByText("全部已读")).not.toBeInTheDocument()
  })

  it("把「」包裹的实体渲染为 chip，并高亮 emphasis 词组", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "新的审批申请",
            content: "李四提交了「康泰医药」审批，请及时审核",
          }),
        ]}
        emphasis={[{ words: ["请及时审核"], tone: "primary" }]}
      />
    )

    expect(screen.getByText("康泰医药")).toBeInTheDocument()
    expect(screen.getByText("请及时审核")).toBeInTheDocument()
  })

  it("点击未读条目先标记已读再触发 onItemClick（invocationCallOrder）", () => {
    const onMarkRead = vi.fn()
    const onItemClick = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "待处理消息",
            content: "内容",
          }),
        ]}
        onMarkRead={onMarkRead}
        onItemClick={onItemClick}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /^未读，待处理消息|^待处理消息/ })
    )

    expect(onMarkRead).toHaveBeenCalledTimes(1)
    expect(onItemClick).toHaveBeenCalledTimes(1)
    // 同行点击必须先标记已读、再交给业务跳转，顺序不能反（用调用序号断言）
    expect(onMarkRead.mock.invocationCallOrder[0]).toBeLessThan(
      onItemClick.mock.invocationCallOrder[0]
    )
  })

  it("已读条目点击时不重复标记已读", () => {
    const onMarkRead = vi.fn()
    const onItemClick = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "已读消息",
            content: "内容",
            read: true,
          }),
        ]}
        onMarkRead={onMarkRead}
        onItemClick={onItemClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^已读消息/ }))

    expect(onMarkRead).not.toHaveBeenCalled()
    expect(onItemClick).toHaveBeenCalledTimes(1)
  })

  it("markReadOnClick=false 时点击只触发 onItemClick", () => {
    const onMarkRead = vi.fn()
    const onItemClick = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "待处理消息",
            content: "内容",
          }),
        ]}
        markReadOnClick={false}
        onMarkRead={onMarkRead}
        onItemClick={onItemClick}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /^未读，待处理消息|^待处理消息/ })
    )

    expect(onMarkRead).not.toHaveBeenCalled()
    expect(onItemClick).toHaveBeenCalledTimes(1)
  })

  it("操作按钮阻止冒泡，只触发自身回调", () => {
    const onMarkRead = vi.fn()
    const onDelete = vi.fn()
    const onItemClick = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "待处理消息",
            content: "内容",
          }),
        ]}
        onMarkRead={onMarkRead}
        onDelete={onDelete}
        onItemClick={onItemClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /标记已读/ }))
    fireEvent.click(screen.getByRole("button", { name: /删除通知/ }))

    expect(onMarkRead).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it("覆盖层按钮触发行点击，行内操作按钮不触发行点击", () => {
    const onItemClick = vi.fn()
    const onMarkRead = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "待处理消息",
            content: "内容",
          }),
        ]}
        onMarkRead={onMarkRead}
        onItemClick={onItemClick}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /^未读，待处理消息|^待处理消息/ })
    )
    expect(onItemClick).toHaveBeenCalledTimes(1)

    onItemClick.mockClear()
    fireEvent.click(screen.getByRole("button", { name: /标记已读/ }))
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it("只传 onMarkRead 时整行可点击并标记已读", () => {
    const onMarkRead = vi.fn()
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "仅标记已读",
            content: "内容",
          }),
        ]}
        onMarkRead={onMarkRead}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^未读，仅标记已读/ }))

    expect(onMarkRead).toHaveBeenCalledTimes(1)
  })

  it("只读模式不渲染操作按钮且条目不可点击", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "只读消息",
            content: "内容",
          }),
        ]}
      />
    )

    expect(screen.queryByRole("button", { name: /标记已读/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /删除通知/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^只读消息/ })).toBeNull()
  })

  it("loading 状态在列表为空时展示加载占位", () => {
    render(<NotificationPanel notifications={[]} loading />)

    expect(screen.getByText("加载中...")).toBeInTheDocument()
    // loading 时空态文案不渲染（唯一 live region 播报"加载中..."）
    expect(screen.queryByText("暂无新消息")).not.toBeInTheDocument()
  })

  it("aria-live 状态区域播报未读数变化与 loading，且面板内只有一处", () => {
    const { rerender } = render(
      <NotificationPanel
        notifications={[
          createNotification({ id: "n1", title: "消息一", content: "内容" }),
          createNotification({ id: "n2", title: "消息二", content: "内容" }),
        ]}
      />
    )

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-atomic", "true")
    expect(status).toHaveTextContent("2 条未读")

    // 未读数变化 → 同一 live region 更新播报
    rerender(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "消息一",
            content: "内容",
            read: true,
          }),
          createNotification({
            id: "n2",
            title: "消息二",
            content: "内容",
            read: true,
          }),
        ]}
      />
    )
    expect(screen.getByRole("status")).toHaveTextContent("0 条未读")

    // loading 也走同一 live region（不再有第二个 sr-only 加载文本）
    rerender(<NotificationPanel notifications={[]} loading />)
    expect(screen.getByRole("status")).toHaveTextContent("加载中...")
    expect(screen.getAllByText("加载中...")).toHaveLength(1)

    // 空态同样只有一个 role="status"（空态容器不再自带 role，避免双播报）
    rerender(<NotificationPanel notifications={[]} />)
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("暂无新消息")
  })

  it("焦点环使用实色 --lg-primary-text，不再使用半透明 primary", () => {
    const { rerender } = render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "待处理消息",
            content: "内容",
          }),
        ]}
        onMarkRead={vi.fn()}
        onDelete={vi.fn()}
        onMarkAllRead={vi.fn()}
      />
    )

    const buttons = [
      screen.getByRole("button", { name: /^未读，待处理消息/ }),
      screen.getByRole("button", { name: /标记已读/ }),
      screen.getByRole("button", { name: /删除通知/ }),
      screen.getByRole("button", { name: "全部已读" }),
    ]

    for (const button of buttons) {
      expect(button.className).toContain(
        "focus-visible:ring-[var(--lg-primary-text)]"
      )
      expect(button.className).not.toContain(
        "focus-visible:ring-[var(--lg-primary)]/40"
      )
    }

    // 错误态「重试」同样使用实色焦点环
    rerender(
      <NotificationPanel
        notifications={[]}
        error="加载失败"
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: "重试" }).className).toContain(
      "focus-visible:ring-[var(--lg-primary-text)]"
    )
  })

  it("非法 createdAt 显示 '-' 兜底，不出现 NaN", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "时间异常消息",
            content: "内容",
            createdAt: "not-a-date",
          }),
        ]}
      />
    )

    const time = screen.getByText("-")
    // 非法 createdAt 不渲染 <time dateTime="not-a-date">，降级为普通文本
    expect(time.tagName.toLowerCase()).toBe("span")
    expect(time).not.toHaveAttribute("dateTime")
    expect(document.body.textContent).not.toContain("NaN")
  })

  it("时间与空态文字引用 --lg-text-secondary，而非低对比 muted", () => {
    const { rerender } = render(
      <NotificationPanel
        notifications={[
          createNotification({ id: "n1", title: "消息", content: "内容" }),
        ]}
        formatTime={() => "刚刚"}
      />
    )

    expect(
      screen.getByText("刚刚").parentElement?.getAttribute("style")
    ).toContain("var(--lg-text-secondary)")

    rerender(<NotificationPanel notifications={[]} />)
    // 空态视觉文本 + sr-only live region 各一份，取可见的大字号 span 校验 token
    const emptyText = screen
      .getAllByText("暂无新消息")
      .find((el) => el.className.includes("text-sm"))
    expect(emptyText?.getAttribute("style")).toContain(
      "var(--lg-text-secondary)"
    )
  })

  it("空列表展示空态，错误态展示重试按钮", () => {
    const { rerender } = render(<NotificationPanel notifications={[]} />)
    expect(screen.getAllByText("暂无新消息").length).toBeGreaterThan(0)

    const onRetry = vi.fn()
    rerender(
      <NotificationPanel
        notifications={[]}
        error="消息加载失败，请稍后重试"
        onRetry={onRetry}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("消息加载失败")
    fireEvent.click(screen.getByRole("button", { name: "重试" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("显式 unreadCount 覆盖本地派生值", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "消息",
            content: "内容",
            read: true,
          }),
        ]}
        unreadCount={5}
      />
    )

    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("5 条未读")).toBeInTheDocument()
  })

  it("按 maxItems 截断列表，支持自定义 formatTime", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({ id: "n1", title: "消息一", content: "内容" }),
          createNotification({ id: "n2", title: "消息二", content: "内容" }),
          createNotification({ id: "n3", title: "消息三", content: "内容" }),
        ]}
        maxItems={2}
        formatTime={() => "刚刚"}
      />
    )

    expect(screen.queryByText("消息三")).not.toBeInTheDocument()
    expect(screen.getAllByText("刚刚")).toHaveLength(2)
  })

  it("maxHeight 下放到 ScrollArea viewport，避免列表被裁切", () => {
    const { container } = render(
      <NotificationPanel
        notifications={[
          createNotification({ id: "n1", title: "消息", content: "内容" }),
        ]}
        maxHeight={240}
      />
    )

    const root = container.querySelector(
      '[data-slot="scroll-area"]'
    ) as HTMLElement
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement

    expect(root.style.getPropertyValue("--notification-list-max-height")).toBe(
      "240px"
    )
    expect(viewport.className).toContain(
      "max-h-[var(--notification-list-max-height)]"
    )
  })

  it("未闭合引号按普通文本渲染，不丢字符", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "消息",
            content: "已处理「A」「B",
          }),
        ]}
      />
    )

    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("「B")).toBeInTheDocument()
  })

  it("renderContent 覆盖默认正文渲染", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "消息",
            content: "默认正文",
          }),
        ]}
        renderContent={() => <span>自定义正文</span>}
      />
    )

    expect(screen.getByText("自定义正文")).toBeInTheDocument()
    expect(screen.queryByText("默认正文")).not.toBeInTheDocument()
  })

  it("未知 type 使用兜底样式且不报错", () => {
    render(
      <NotificationPanel
        notifications={[
          createNotification({
            id: "n1",
            title: "未知类型消息",
            content: "内容",
            type: "unknown-type",
          }),
        ]}
      />
    )

    expect(screen.getByText("未知类型消息")).toBeInTheDocument()
  })
})

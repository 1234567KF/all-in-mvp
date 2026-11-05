import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { NotificationItem } from "@/components/shared/notification-config"
import { NotificationCenter } from "@/components/shared/NotificationCenter"

const notification: NotificationItem = {
  id: "n1",
  type: "info",
  title: "待处理消息",
  content: "这是演示正文",
  createdAt: "2026-07-26T10:00:00.000Z",
  read: false,
}

describe("NotificationCenter", () => {
  afterEach(() => cleanup())

  it("defaultOpen 时展示面板，点击条目后回调并关闭", () => {
    const onItemClick = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <NotificationCenter
        defaultOpen
        notifications={[notification]}
        onItemClick={onItemClick}
        onOpenChange={onOpenChange}
      />
    )

    expect(screen.getByRole("dialog", { name: "消息通知" })).toBeInTheDocument()
    expect(screen.getByText("消息通知")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^未读，待处理消息/ }))

    expect(onItemClick).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // 关闭必须是「弹层从 DOM 消失」，而不是仅触发回调
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("点击默认铃铛打开面板", () => {
    render(<NotificationCenter notifications={[notification]} />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "消息通知，1 条未读" }))
    expect(screen.getByRole("dialog", { name: "消息通知" })).toBeInTheDocument()
  })

  it("不传 onItemClick 时保留只读语义，点击条目不会关闭面板", () => {
    const onOpenChange = vi.fn()
    render(
      <NotificationCenter
        defaultOpen
        onOpenChange={onOpenChange}
        notifications={[notification]}
      />
    )

    expect(
      screen.queryByRole("button", { name: /^未读，待处理消息/ })
    ).toBeNull()
    fireEvent.click(screen.getByText("待处理消息"))

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("自定义 title 同步触发器与弹层 aria-label", () => {
    render(
      <NotificationCenter
        defaultOpen
        notifications={[notification]}
        title="审批消息"
      />
    )

    expect(
      screen.getByRole("button", { name: "审批消息，1 条未读" })
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "审批消息" })).toBeInTheDocument()
  })

  it("支持自定义 trigger", () => {
    render(
      <NotificationCenter
        defaultOpen
        notifications={[notification]}
        trigger={<button type="button">自定义入口</button>}
      />
    )

    expect(
      screen.getByRole("button", { name: "自定义入口" })
    ).toBeInTheDocument()
    expect(screen.getByText("消息通知")).toBeInTheDocument()
  })

  it("受控 open：点击条目只上报关闭，rerender open=false 后弹层真正消失", () => {
    const onOpenChange = vi.fn()
    const onItemClick = vi.fn()
    const baseProps = {
      onOpenChange,
      notifications: [notification],
      onItemClick,
    }
    const { rerender } = render(<NotificationCenter {...baseProps} open />)

    expect(screen.getByRole("dialog", { name: "消息通知" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^未读，待处理消息/ }))

    expect(onItemClick).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // 受控组件不能自行关闭：必须先由父级接收回调
    expect(screen.getByRole("dialog", { name: "消息通知" })).toBeInTheDocument()

    rerender(<NotificationCenter {...baseProps} open={false} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

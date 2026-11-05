import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { NotificationBell } from "@/components/shared/NotificationBell"

describe("NotificationBell", () => {
  afterEach(() => cleanup())

  it("unreadCount=0 时不显示角标", () => {
    render(<NotificationBell unreadCount={0} />)

    expect(screen.queryByText("0")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "消息通知" })).toBeInTheDocument()
  })

  it("显示未读数并在 aria-label 中带上数量", () => {
    render(<NotificationBell unreadCount={3} />)

    expect(screen.getByText("3")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "消息通知，3 条未读" })
    ).toBeInTheDocument()
  })

  it("超过 99 显示 99+", () => {
    render(<NotificationBell unreadCount={128} />)

    expect(screen.getByText("99+")).toBeInTheDocument()
  })

  it("支持自定义 maxCount 与 label", () => {
    render(<NotificationBell unreadCount={12} maxCount={9} label="站内信" />)

    expect(screen.getByText("9+")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "站内信，12 条未读" })
    ).toBeInTheDocument()
  })
})

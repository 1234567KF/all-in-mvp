import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { NotificationItem } from "@/components/shared/notification-config"
import { useDemoNotifications } from "@/hooks/useDemoNotifications"

const initialNotifications: NotificationItem[] = [
  {
    id: "n1",
    title: "未读消息",
    content: "内容",
    createdAt: "2026-07-26T10:00:00.000Z",
    read: false,
  },
  {
    id: "n2",
    title: "已读消息",
    content: "内容",
    createdAt: "2026-07-26T09:00:00.000Z",
    read: true,
  },
]

describe("useDemoNotifications", () => {
  it("派生未读数，并支持单条/全部已读", () => {
    const { result } = renderHook(() =>
      useDemoNotifications(initialNotifications)
    )

    expect(result.current.unreadCount).toBe(1)

    act(() => result.current.markRead("n1"))
    expect(result.current.unreadCount).toBe(0)
    expect(
      result.current.notifications.find((item) => item.id === "n1")?.read
    ).toBe(true)

    act(() => result.current.markAllRead())
    expect(result.current.unreadCount).toBe(0)
  })

  it("删除未读/已读消息并正确维护未读数", () => {
    const { result } = renderHook(() =>
      useDemoNotifications(initialNotifications)
    )

    act(() => result.current.remove("n1"))
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.unreadCount).toBe(0)

    act(() => result.current.remove("n2"))
    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it("reset 恢复初始数据", () => {
    const { result } = renderHook(() =>
      useDemoNotifications(initialNotifications)
    )

    act(() => result.current.markAllRead())
    expect(result.current.unreadCount).toBe(0)

    act(() => result.current.reset())
    expect(result.current.unreadCount).toBe(1)
    expect(result.current.notifications).toHaveLength(2)
  })
})

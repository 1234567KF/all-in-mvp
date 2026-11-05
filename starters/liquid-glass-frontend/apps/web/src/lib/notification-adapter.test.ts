/**
 * toNotificationItem 单测 —— wire → view model 的字段映射是 UI 与后端契约的边界
 */
import type { Notification } from "shared"
import { describe, expect, it } from "vitest"

import { toNotificationItem } from "@/lib/notification-adapter"

/** 完整 wire 行（DB 行原样，isRead 为 0 | 1） */
function createWireNotification(
  overrides: Partial<Notification> = {}
): Notification {
  return {
    id: "notification-1",
    recipientId: "user-1",
    type: "info",
    title: "新的审批申请",
    content: "请及时审核",
    payload: null,
    isRead: 0,
    readTime: null,
    createTime: "2026-01-01T08:30:00.000Z",
    ...overrides,
  }
}

describe("toNotificationItem", () => {
  it("映射基础字段：createTime → createdAt、isRead 0 → read=false", () => {
    const item = toNotificationItem(createWireNotification())

    expect(item).toEqual({
      id: "notification-1",
      title: "新的审批申请",
      content: "请及时审核",
      createdAt: "2026-01-01T08:30:00.000Z",
      read: false,
      type: "info",
      href: undefined,
      meta: undefined,
    })
  })

  it("isRead=1 映射为 read=true", () => {
    const item = toNotificationItem(createWireNotification({ isRead: 1 }))

    expect(item.read).toBe(true)
  })

  it("payload.href 提升为 href，其余 payload 字段进 meta", () => {
    const item = toNotificationItem(
      createWireNotification({
        payload: {
          href: "/dashboard",
          relatedCode: "APPROVAL-42",
          sender: "李四",
        },
      })
    )

    expect(item.href).toBe("/dashboard")
    expect(item.meta).toEqual({ relatedCode: "APPROVAL-42", sender: "李四" })
    // href 只保留在顶层字段，不在 meta 重复
    expect(item.meta).not.toHaveProperty("href")
  })

  it("payload 只有 href 时 meta 缺省", () => {
    const item = toNotificationItem(
      createWireNotification({ payload: { href: "/components/notifications" } })
    )

    expect(item.href).toBe("/components/notifications")
    expect(item.meta).toBeUndefined()
  })

  it("payload 为 null / undefined 时 href 与 meta 均缺省", () => {
    expect(
      toNotificationItem(createWireNotification({ payload: null })).href
    ).toBeUndefined()
    expect(
      toNotificationItem(createWireNotification({ payload: undefined })).meta
    ).toBeUndefined()
  })

  it("payload.href 非字符串或空串时不作为跳转目标", () => {
    const nonStringHref = toNotificationItem(
      createWireNotification({ payload: { href: 42 } })
    )
    const emptyHref = toNotificationItem(
      createWireNotification({ payload: { href: "" } })
    )

    expect(nonStringHref.href).toBeUndefined()
    expect(emptyHref.href).toBeUndefined()
  })

  it("payload 为非对象（字符串/数组）时 href 与 meta 均缺省", () => {
    const stringPayload = toNotificationItem(
      createWireNotification({
        payload: "not-an-object" as unknown as Notification["payload"],
      })
    )
    const arrayPayload = toNotificationItem(
      createWireNotification({
        payload: ["/dashboard"] as unknown as Notification["payload"],
      })
    )

    expect(stringPayload.href).toBeUndefined()
    expect(stringPayload.meta).toBeUndefined()
    expect(arrayPayload.href).toBeUndefined()
    expect(arrayPayload.meta).toBeUndefined()
  })

  it("只接受站内绝对路径作为 href，拒绝协议 URL 与协议相对地址", () => {
    expect(
      toNotificationItem(
        createWireNotification({ payload: { href: "//evil.com/path" } })
      ).href
    ).toBeUndefined()
    expect(
      toNotificationItem(
        createWireNotification({ payload: { href: "javascript:alert(1)" } })
      ).href
    ).toBeUndefined()
    expect(
      toNotificationItem(
        createWireNotification({ payload: { href: "https://example.com" } })
      ).href
    ).toBeUndefined()
    expect(
      toNotificationItem(
        createWireNotification({ payload: { href: "/settings" } })
      ).href
    ).toBe("/settings")
  })

  it("content 为空字符串时原样透传（UI 可渲染仅标题条目）", () => {
    const item = toNotificationItem(createWireNotification({ content: "" }))

    expect(item.content).toBe("")
  })
})

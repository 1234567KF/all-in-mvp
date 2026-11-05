/**
 * shared/notification-bus 单元测试
 *
 * 覆盖：按收件人隔离、多订阅者广播、取消订阅幂等、坏监听器不影响其他订阅者。
 */
import { describe, expect, it } from "bun:test"
import type { Notification } from "shared"

import { InMemoryNotificationBus, notificationBus } from "./notification-bus.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n-1",
    recipientId: "alice",
    type: "system",
    title: "标题",
    content: "正文",
    payload: null,
    isRead: 0,
    readTime: null,
    createTime: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InMemoryNotificationBus", () => {
  it("publish 后订阅者收到同一条通知", () => {
    const bus = new InMemoryNotificationBus()
    const received: Notification[] = []
    bus.subscribe("alice", (n) => received.push(n))

    const notification = makeNotification()
    bus.publish(notification)

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(notification)
  })

  it("按收件人隔离：不会收到别人的消息", () => {
    const bus = new InMemoryNotificationBus()
    const aliceReceived: Notification[] = []
    const bobReceived: Notification[] = []
    bus.subscribe("alice", (n) => aliceReceived.push(n))
    bus.subscribe("bob", (n) => bobReceived.push(n))

    bus.publish(makeNotification({ recipientId: "alice" }))
    bus.publish(makeNotification({ id: "n-2", recipientId: "bob" }))

    expect(aliceReceived.map((n) => n.id)).toEqual(["n-1"])
    expect(bobReceived.map((n) => n.id)).toEqual(["n-2"])
  })

  it("同一收件人的多个订阅者都会收到（多标签页/多端）", () => {
    const bus = new InMemoryNotificationBus()
    const a: Notification[] = []
    const b: Notification[] = []
    bus.subscribe("alice", (n) => a.push(n))
    bus.subscribe("alice", (n) => b.push(n))

    expect(bus.listenerCount("alice")).toBe(2)
    bus.publish(makeNotification())

    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
  })

  it("取消订阅后不再收到，且重复取消安全（幂等）", () => {
    const bus = new InMemoryNotificationBus()
    const received: Notification[] = []
    const unsubscribe = bus.subscribe("alice", (n) => received.push(n))

    unsubscribe()
    unsubscribe() // 重复调用不应抛错或影响其他监听器
    bus.publish(makeNotification())

    expect(received).toHaveLength(0)
    expect(bus.listenerCount("alice")).toBe(0)
  })

  it("取消一个订阅者不影响同收件人的其他订阅者", () => {
    const bus = new InMemoryNotificationBus()
    const received: Notification[] = []
    const unsubscribeA = bus.subscribe("alice", () => {})
    bus.subscribe("alice", (n) => received.push(n))

    unsubscribeA()
    bus.publish(makeNotification())

    expect(received).toHaveLength(1)
    expect(bus.listenerCount("alice")).toBe(1)
  })

  it("监听器抛错不冒泡到 publish，也不影响其他订阅者", () => {
    const bus = new InMemoryNotificationBus()
    const received: Notification[] = []
    bus.subscribe("alice", () => {
      throw new Error("SSE 写入失败")
    })
    bus.subscribe("alice", (n) => received.push(n))

    // publish 不抛错；坏订阅者被隔离
    expect(() => bus.publish(makeNotification())).not.toThrow()
    expect(received).toHaveLength(1)
  })

  it("单例导出可正常订阅/发布", () => {
    const received: Notification[] = []
    const unsubscribe = notificationBus.subscribe("singleton-user", (n) =>
      received.push(n)
    )
    notificationBus.publish(makeNotification({ recipientId: "singleton-user" }))
    unsubscribe()

    expect(received).toHaveLength(1)
    expect(notificationBus.listenerCount("singleton-user")).toBe(0)
  })
})

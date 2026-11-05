/**
 * 消息通知共享契约测试（api / web 单一事实源）
 *
 * 锁定 wire 形状与分页参数语义：这些 schema 同时被后端 route 校验、SSE 推送
 * 序列化、前端 adapter 消费使用，改动需在此显式体现。
 */
import { describe, expect, it } from "vitest"

import {
  NOTIFICATION_STREAM_EVENT,
  NotificationListQuerySchema,
  NotificationPageSchema,
  NotificationSchema,
  NotificationUnreadCountSchema,
} from "./notification.js"

// ── NotificationSchema ───────────────────────────────────────────────────────

describe("NotificationSchema", () => {
  const validNotification = {
    id: "n-1",
    recipientId: "admin",
    type: "approval",
    title: "新的审批申请",
    content: "李四提交了审批「Q4 发布计划」",
    payload: { href: "/dashboard" },
    isRead: 0,
    readTime: null,
    createTime: "2026-01-01T00:00:00.000Z",
  }

  it("解析合法 wire 数据", () => {
    const parsed = NotificationSchema.parse(validNotification)
    expect(parsed.type).toBe("approval")
    expect(parsed.payload).toEqual({ href: "/dashboard" })
  })

  it("payload 可省略或为 null（业务可无载荷）", () => {
    const withoutPayload = { ...validNotification }
    delete (withoutPayload as { payload?: unknown }).payload
    // @ts-expect-error 测试故意删除 optional 字段
    expect(NotificationSchema.parse(withoutPayload).payload).toBeUndefined()
    expect(
      NotificationSchema.parse({ ...validNotification, payload: null }).payload
    ).toBeNull()
  })

  it("type 是不透明字符串：任意业务 key 均合法（不做枚举约束）", () => {
    expect(() =>
      NotificationSchema.parse({ ...validNotification, type: "any-biz-type" })
    ).not.toThrow()
    expect(() =>
      NotificationSchema.parse({ ...validNotification, type: "" })
    ).toThrow()
  })
})

// ── 列表查询参数 ─────────────────────────────────────────────────────────────

describe("NotificationListQuerySchema", () => {
  it("缺省 limit=20、unreadOnly=false、cursor 不填", () => {
    expect(NotificationListQuerySchema.parse({})).toEqual({
      limit: 20,
      unreadOnly: false,
    })
  })

  it("字符串 query 参数按契约转换（limit 强转数字、unreadOnly 支持 1/0/true/false）", () => {
    expect(
      NotificationListQuerySchema.parse({ limit: "5", unreadOnly: "true" })
    ).toMatchObject({ limit: 5, unreadOnly: true })
    expect(
      NotificationListQuerySchema.parse({ limit: "5", unreadOnly: "1" })
    ).toMatchObject({ limit: 5, unreadOnly: true })
    expect(
      NotificationListQuerySchema.parse({ unreadOnly: "false" })
    ).toMatchObject({ unreadOnly: false })
    expect(
      NotificationListQuerySchema.parse({ unreadOnly: "0" })
    ).toMatchObject({ unreadOnly: false })
  })

  it("limit 越界（<1 或 >100）拒绝", () => {
    expect(NotificationListQuerySchema.safeParse({ limit: "0" }).success).toBe(
      false
    )
    expect(
      NotificationListQuerySchema.safeParse({ limit: "101" }).success
    ).toBe(false)
  })

  it("游标是字符串（对客户端不透明）", () => {
    expect(
      NotificationListQuerySchema.parse({
        cursor: "2026-01-01T00:00:00.000Z|n-1",
      }).cursor
    ).toBe("2026-01-01T00:00:00.000Z|n-1")
  })
})

// ── 响应契约 ─────────────────────────────────────────────────────────────────

describe("响应契约", () => {
  it("NotificationPageSchema：items + nextCursor(nullable) + hasMore", () => {
    expect(
      NotificationPageSchema.parse({
        items: [],
        nextCursor: null,
        hasMore: false,
      })
    ).toEqual({ items: [], nextCursor: null, hasMore: false })
    expect(
      NotificationPageSchema.safeParse({ items: [], hasMore: false }).success
    ).toBe(false)
  })

  it("NotificationUnreadCountSchema：非负整数", () => {
    expect(NotificationUnreadCountSchema.parse({ count: 0 }).count).toBe(0)
    expect(NotificationUnreadCountSchema.safeParse({ count: -1 }).success).toBe(
      false
    )
    expect(
      NotificationUnreadCountSchema.safeParse({ count: 1.5 }).success
    ).toBe(false)
  })

  it("SSE 事件名与前端订阅端共用同一常量，避免魔法字符串漂移", () => {
    expect(NOTIFICATION_STREAM_EVENT).toBe("notification")
  })
})

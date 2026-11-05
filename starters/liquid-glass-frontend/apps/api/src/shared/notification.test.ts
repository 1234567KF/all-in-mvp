/**
 * shared/notification 单元测试（核心内核）
 *
 * 覆盖三条不变量：
 * 1. 先落库后 publish（订阅者收到消息时 DB 已可查到）；
 * 2. dedupeKey 幂等（冲突静默跳过，不抛错）；
 * 3. notify 抛错 / notifySafe 吞错返回 null。
 */
import { beforeEach, describe, expect, it } from "bun:test"
import type { Notification } from "shared"

import { getDrizzle } from "../db.js"
import { notifications } from "../db/schema.js"
import { setupTestDb } from "../test-helpers.js"
import { notify, notifyMany, notifySafe } from "./notification.js"
import { notificationBus } from "./notification-bus.js"
import { ValidationError } from "./service-error.js"

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setupTestDb()
  getDrizzle().delete(notifications).run()
})

function allRows() {
  return getDrizzle().select().from(notifications).all()
}

// ── notify ────────────────────────────────────────────────────────────────────

describe("notify", () => {
  it("写入 DB 并返回 wire Notification（id uuid、默认值、ISO createTime）", () => {
    const notification = notify({
      recipientId: "alice",
      type: "approval",
      title: "新的审批申请",
    })

    expect(notification).not.toBeNull()
    const n = notification!
    expect(n.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(n.recipientId).toBe("alice")
    expect(n.type).toBe("approval")
    expect(n.title).toBe("新的审批申请")
    expect(n.content).toBe("")
    expect(n.payload).toBeNull()
    expect(n.isRead).toBe(0)
    expect(n.readTime).toBeNull()
    expect(new Date(n.createTime).toISOString()).toBe(n.createTime)

    const rows = allRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(n.id)
    expect(rows[0].isRead).toBe(0)
  })

  it("payload 以 JSON 落库并能原样读回", () => {
    const payload = { href: "/components/notifications", sender: "李四" }
    const notification = notify({
      recipientId: "alice",
      type: "assigned",
      title: "任务已指派",
      content: "请跟进「消息中心」",
      payload,
    })

    expect(notification!.payload).toEqual(payload)
    const row = allRows()[0]
    expect(row.payload).toEqual(payload)
  })

  it("显式 createTime 覆盖默认时间（补数据/测试用）", () => {
    const createTime = "2025-06-01T08:00:00.000Z"
    const notification = notify({
      recipientId: "alice",
      type: "system",
      title: "历史消息",
      createTime,
    })
    expect(notification!.createTime).toBe(createTime)
  })

  it("先落库后 publish：订阅者收到消息时 DB 已可查到", () => {
    const seenInDb: number[] = []
    const unsubscribe = notificationBus.subscribe("alice", (n) => {
      const row = getDrizzle()
        .select()
        .from(notifications)
        .all()
        .find((r) => r.id === n.id)
      seenInDb.push(row ? 1 : 0)
    })

    try {
      notify({ recipientId: "alice", type: "system", title: "实时消息" })
    } finally {
      unsubscribe()
    }

    expect(seenInDb).toEqual([1])
  })

  it("dedupeKey 冲突时静默跳过（返回 null、不抛错、不新增行、不覆盖首条）", () => {
    const first = notify({
      recipientId: "alice",
      type: "system",
      title: "首次",
      dedupeKey: "order-1-completed",
    })
    expect(first).not.toBeNull()

    const published: Notification[] = []
    const unsubscribe = notificationBus.subscribe("alice", (n) =>
      published.push(n)
    )
    try {
      // 重复调用不抛错，且被跳过
      expect(() =>
        notify({
          recipientId: "alice",
          type: "system",
          title: "重复",
          dedupeKey: "order-1-completed",
        })
      ).not.toThrow()
    } finally {
      unsubscribe()
    }

    expect(
      notify({
        recipientId: "alice",
        type: "system",
        title: "第三次",
        dedupeKey: "order-1-completed",
      })
    ).toBeNull()
    // 跳过的不推送
    expect(published).toHaveLength(0)

    const rows = allRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe("首次")
  })

  it("相同 dedupeKey 对不同收件人各自生效", () => {
    notify({ recipientId: "alice", type: "system", title: "A", dedupeKey: "k" })
    notify({ recipientId: "bob", type: "system", title: "B", dedupeKey: "k" })
    expect(allRows()).toHaveLength(2)
  })

  it("不带 dedupeKey 的消息可重复写入（NULL 互不冲突）", () => {
    notify({ recipientId: "alice", type: "system", title: "重复消息" })
    notify({ recipientId: "alice", type: "system", title: "重复消息" })
    expect(allRows()).toHaveLength(2)
  })

  it("DB 异常时抛错（交给调用方处理）", () => {
    // recipientId 为 NULL 触发 NOT NULL 约束失败 —— 验证 notify 不做静默吞错
    expect(() =>
      notify({
        recipientId: null as unknown as string,
        type: "system",
        title: "非法",
      })
    ).toThrow()
    expect(allRows()).toHaveLength(0)
  })
})

// ── notifyMany ────────────────────────────────────────────────────────────────

describe("notifyMany", () => {
  it("扇出给多收件人，返回实际写入的消息", () => {
    const created = notifyMany(["alice", "bob", "carol"], {
      type: "announcement",
      title: "系统公告",
      content: "周六维护",
      payload: { href: "/dashboard" },
    })

    expect(created).toHaveLength(3)
    expect(created.map((n) => n.recipientId)).toEqual(["alice", "bob", "carol"])
    expect(allRows()).toHaveLength(3)
  })

  it("收件人重复时自动去重（同一条消息只写一次/只推一次）", () => {
    const received: Notification[] = []
    const created: Notification[] = []
    const unsubscribe = notificationBus.subscribe("alice", (n) =>
      received.push(n)
    )
    try {
      created.push(
        ...notifyMany(["alice", "alice"], {
          type: "system",
          title: "去重",
        })
      )
    } finally {
      unsubscribe()
    }

    expect(created).toHaveLength(1)
    expect(received).toHaveLength(1)
    expect(allRows()).toHaveLength(1)
  })

  it("dedupeKey 与部分收件人冲突时只写入未冲突者", () => {
    notify({
      recipientId: "alice",
      type: "system",
      title: "已有",
      dedupeKey: "digest-2026-01",
    })

    const created = notifyMany(["alice", "bob"], {
      type: "system",
      title: "汇总",
      dedupeKey: "digest-2026-01",
    })

    expect(created.map((n) => n.recipientId)).toEqual(["bob"])
    expect(allRows()).toHaveLength(2)
  })

  it("空收件人列表 → 不写入直接返回空数组", () => {
    expect(notifyMany([], { type: "system", title: "空" })).toEqual([])
    expect(allRows()).toHaveLength(0)
  })
})

// ── notifySafe ────────────────────────────────────────────────────────────────

describe("notifySafe", () => {
  it("正常写入时返回 Notification", () => {
    const notification = notifySafe({
      recipientId: "alice",
      type: "system",
      title: "安全写入",
    })
    expect(notification?.title).toBe("安全写入")
  })

  it("DB 异常时吞错并返回 null（不中断业务主流程）", () => {
    const notification = notifySafe({
      recipientId: null as unknown as string,
      type: "system",
      title: "非法",
    })
    expect(notification).toBeNull()
    expect(allRows()).toHaveLength(0)
  })
})

// ── 写入前校验（P0：非法输入不得落库产生"毒行"）─────────────────────────────

describe("写入前校验", () => {
  it("type 为空串 → 抛 ValidationError 且不落库、不 publish", () => {
    const pushed: Notification[] = []
    const unsubscribe = notificationBus.subscribe("alice", (n) =>
      pushed.push(n)
    )

    expect(() =>
      notify({ recipientId: "alice", type: "", title: "标题" })
    ).toThrow(ValidationError)
    expect(allRows()).toHaveLength(0)
    expect(pushed).toHaveLength(0)
    unsubscribe()
  })

  it("payload 非普通对象（数组）→ 抛 ValidationError 且不落库", () => {
    expect(() =>
      notify({
        recipientId: "alice",
        type: "info",
        title: "标题",
        payload: ["not", "object"] as unknown as Record<string, unknown>,
      })
    ).toThrow(ValidationError)
    expect(allRows()).toHaveLength(0)
  })

  it("createTime 非法 → 抛 ValidationError 且不落库", () => {
    expect(() =>
      notify({
        recipientId: "alice",
        type: "info",
        title: "标题",
        createTime: "not-a-date",
      })
    ).toThrow(ValidationError)
    expect(allRows()).toHaveLength(0)
  })

  it("createTime 带时区偏移 → 归一化为 UTC ISO 落库", () => {
    const n = notify({
      recipientId: "alice",
      type: "info",
      title: "标题",
      createTime: "2026-01-01T08:00:00+08:00",
    })

    expect(n!.createTime).toBe("2026-01-01T00:00:00.000Z")
    expect(allRows()[0].createTime).toBe("2026-01-01T00:00:00.000Z")
  })

  it("dedupeKey 为空串/纯空白时按 NULL 处理，不会吞掉后续消息", () => {
    const first = notify({
      recipientId: "alice",
      type: "info",
      title: "第一条",
      dedupeKey: "",
    })
    const second = notify({
      recipientId: "alice",
      type: "info",
      title: "第二条",
      dedupeKey: "   ",
    })

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(allRows()).toHaveLength(2)
    expect(allRows().every((row) => row.dedupeKey === null)).toBe(true)
  })

  it("notifyMany 先校验全部收件人再写库：非法输入整批不落库", () => {
    expect(() =>
      notifyMany(["alice", "bob"], {
        type: "",
        title: "标题",
      })
    ).toThrow(ValidationError)
    expect(allRows()).toHaveLength(0)
  })
})

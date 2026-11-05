/**
 * modules/notification 集成测试（route + service + bus）
 *
 * 覆盖：
 * - 6 个 HTTP 端点 + 未认证 401（含 SSE）
 * - 游标分页（含同 createTime 兜底，不跨页漏数）、unreadOnly、非法 cursor/limit
 * - 单条已读幂等（readTime 不刷新）、全部已读（type 过滤）、删除
 * - 越权：读/改/删别人的消息 → 404，且不产生副作用
 * - SSE：有界读取首个事件（AbortController + 超时保护，不会挂住测试）、
 *   事件名用共享常量、data 为 Notification JSON、断开后 bus 订阅被取消
 * - dev-only 造数端点：开发环境可写；生产环境 404
 *
 * 运行方式：bun test src/modules/notification/notification.route.test.ts
 */
import { beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import jwt from "jsonwebtoken"
import {
  type Notification,
  NOTIFICATION_STREAM_EVENT,
  NotificationSchema,
} from "shared"

import { getDrizzle } from "../../db.js"
import { notifications, users } from "../../db/schema.js"
import { env } from "../../env.js"
import { JWT_SECRET } from "../../middleware/auth.js"
import { notify } from "../../shared/notification.js"
import { notificationBus } from "../../shared/notification-bus.js"
import { setupTestDb } from "../../test-helpers.js"
import notificationsRoute, {
  NOTIFICATION_STREAM_HEARTBEAT_MS,
} from "./notification.route.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ME = { email: "me@example.com", name: "本人", role: "user" }
const OTHER = { email: "other@example.com", name: "别人", role: "user" }

/** 固定基准时间：让测试数据 createTime 完全可控、可断言 */
const BASE_TIME = Date.parse("2026-01-01T00:00:00.000Z")

let app: Hono
let meToken: string
let otherToken: string
let seq = 0

function signToken(email: string) {
  return jwt.sign({ sub: email, username: email, role: "user" }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  })
}

beforeAll(() => {
  setupTestDb()
  getDrizzle().insert(users).values([ME, OTHER]).run()

  app = new Hono()
  app.route("/notifications", notificationsRoute)
  meToken = signToken(ME.email)
  otherToken = signToken(OTHER.email)
})

beforeEach(() => {
  getDrizzle().delete(notifications).run()
  seq = 0
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** 播种一条通知（createTime 递增，保证分页断言稳定） */
function seedNotification(
  overrides: Partial<Parameters<typeof notify>[0]> = {}
): Notification {
  seq += 1
  const notification = notify({
    recipientId: ME.email,
    type: "system",
    title: `消息 ${seq}`,
    content: `正文 ${seq}`,
    createTime: new Date(BASE_TIME + seq * 60_000).toISOString(),
    ...overrides,
  })
  if (!notification) throw new Error("测试播种失败：notify 返回 null")
  return notification
}

interface CallOptions {
  token?: string
  /** 不传 token（显式未认证） */
  anonymous?: boolean
  body?: unknown
}

async function call(method: string, url: string, options: CallOptions = {}) {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers["Content-Type"] = "application/json"
  if (!options.anonymous) {
    headers.Authorization = `Bearer ${options.token ?? meToken}`
  }
  const res = await app.request(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  return {
    status: res.status,
    body: (await res.json()) as {
      success: boolean
      code?: string
      message?: string
      data?: Record<string, unknown>
    },
  }
}

function dataOf<T>(body: { data?: Record<string, unknown> }): T {
  return body.data as T
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 有界等待：超时抛错而不是永久挂住（SSE/异步清理测试必备） */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} 超时（${ms}ms）`)),
          ms
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 从 SSE 流读取直到出现 marker（有界，不会挂住） */
async function readSseUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  state: { buffer: string },
  marker: string,
  timeoutMs = 2000
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (!state.buffer.includes(marker)) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error(
        `SSE 读取超时，等待 ${JSON.stringify(marker)}；已收到 ${JSON.stringify(state.buffer)}`
      )
    }
    const chunk = await withTimeout(reader.read(), remaining, "SSE read()")
    if (chunk.done) {
      throw new Error(`SSE 流提前结束；已收到 ${JSON.stringify(state.buffer)}`)
    }
    state.buffer += decoder.decode(chunk.value, { stream: true })
  }
  const end = state.buffer.indexOf(marker) + marker.length
  const result = state.buffer.slice(0, end)
  state.buffer = state.buffer.slice(end)
  return result
}

// ── 认证 ─────────────────────────────────────────────────────────────────────

describe("认证：未认证一律 401", () => {
  const endpoints: ReadonlyArray<readonly [string, string]> = [
    ["GET", "/notifications"],
    ["GET", "/notifications/unread-count"],
    ["GET", "/notifications/stream"],
    ["POST", "/notifications/read-all"],
    ["POST", "/notifications/any-id/read"],
    ["DELETE", "/notifications/any-id"],
    ["POST", "/notifications/dev/push"],
    ["POST", "/notifications/dev/reset"],
  ]

  for (const [method, url] of endpoints) {
    it(`${method} ${url} 无 token → 401`, async () => {
      const { status, body } = await call(method, url, { anonymous: true })
      expect(status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.code).toBe("UNAUTHORIZED")
    })
  }
})

// ── GET /notifications ───────────────────────────────────────────────────────

describe("GET /notifications 列表", () => {
  it("空列表 → items 空、nextCursor null、hasMore false", async () => {
    const { status, body } = await call("GET", "/notifications")
    expect(status).toBe(200)
    expect(dataOf(body)).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
  })

  it("他人 token 只能看到自己的收件箱", async () => {
    const mine = seedNotification()
    const others = seedNotification({ recipientId: OTHER.email })

    const { status, body } = await call("GET", "/notifications", {
      token: otherToken,
    })
    expect(status).toBe(200)
    const items = dataOf<{ items: Notification[] }>(body).items
    expect(items.map((n) => n.id)).toEqual([others.id])
    expect(items.some((n) => n.id === mine.id)).toBe(false)
  })

  it("默认按 createTime 倒序，返回 shared NotificationPage 形状", async () => {
    const first = seedNotification({ title: "较早" })
    const second = seedNotification({ title: "较晚" })

    const { status, body } = await call("GET", "/notifications")
    expect(status).toBe(200)
    const page = dataOf<{
      items: Notification[]
      nextCursor: string | null
      hasMore: boolean
    }>(body)
    expect(page.items.map((n) => n.id)).toEqual([second.id, first.id])
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBeNull()
    // wire 契约字段齐全（NotificationSchema 可解析）
    expect(NotificationSchema.parse(page.items[0]).title).toBe("较晚")
  })

  it("游标分页遍历全部数据，不重复不遗漏", async () => {
    const seeded = Array.from({ length: 5 }, () => seedNotification())
    const expected = [...seeded].reverse().map((n) => n.id) // createTime 倒序

    const collected: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const url = `/notifications?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
      const { status, body } = await call("GET", url)
      expect(status).toBe(200)
      const page = dataOf<{
        items: Notification[]
        nextCursor: string | null
        hasMore: boolean
      }>(body)
      collected.push(...page.items.map((n) => n.id))
      cursor = page.nextCursor
      pages += 1
      expect(pages).toBeLessThanOrEqual(5) // 防御死循环
      if (!page.hasMore) expect(page.nextCursor).toBeNull()
    } while (cursor)

    expect(pages).toBe(3) // 2 + 2 + 1
    expect(collected).toEqual(expected)
  })

  it("同一 createTime 的多条通过 id 兜底排序，跨页不丢数据", async () => {
    const at = new Date(BASE_TIME).toISOString()
    const ids = [1, 2, 3].map(() => seedNotification({ createTime: at }).id)
    // 期望顺序：createTime 相同 → 按 id 倒序（服务端 ORDER BY 语义）
    const expected = [...ids].sort((a, b) => (a < b ? 1 : -1))

    const collected: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const url = `/notifications?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
      const { body } = await call("GET", url)
      const page = dataOf<{
        items: Notification[]
        nextCursor: string | null
        hasMore: boolean
      }>(body)
      // 每页最多 limit 条，且非末页必须给出 nextCursor（防止 cursor 不前进死循环）
      expect(page.items.length).toBeLessThanOrEqual(2)
      if (page.hasMore) expect(page.nextCursor).not.toBeNull()
      collected.push(...page.items.map((n) => n.id))
      cursor = page.nextCursor
      pages += 1
      expect(pages).toBeLessThanOrEqual(3)
    } while (cursor)

    expect(pages).toBe(2) // 2 + 1
    expect(collected).toEqual(expected)
  })

  it("unreadOnly=true 只返回未读；false 返回全部", async () => {
    const unreadA = seedNotification()
    const unreadB = seedNotification()
    const read = seedNotification()
    getDrizzle()
      .update(notifications)
      .set({ isRead: 1, readTime: new Date().toISOString() })
      .where(eq(notifications.id, read.id))
      .run()

    const onlyUnread = await call("GET", "/notifications?unreadOnly=true")
    const unreadIds = dataOf<{ items: Notification[] }>(
      onlyUnread.body
    ).items.map((n) => n.id)
    expect(unreadIds.sort()).toEqual([unreadA.id, unreadB.id].sort())

    const all = await call("GET", "/notifications?unreadOnly=false")
    expect(dataOf<{ items: Notification[] }>(all.body).items).toHaveLength(3)
  })

  it("limit 越界 / 非法 cursor → 400 VALIDATION_ERROR", async () => {
    const tooLarge = await call("GET", "/notifications?limit=101")
    expect(tooLarge.status).toBe(400)
    expect(tooLarge.body.code).toBe("VALIDATION_ERROR")

    const zero = await call("GET", "/notifications?limit=0")
    expect(zero.status).toBe(400)
    expect(zero.body.code).toBe("VALIDATION_ERROR")

    const badCursor = await call("GET", "/notifications?cursor=not-a-date")
    expect(badCursor.status).toBe(400)
    expect(badCursor.body.code).toBe("VALIDATION_ERROR")
  })
})

// ── GET /notifications/unread-count ─────────────────────────────────────────

describe("GET /notifications/unread-count", () => {
  it("无消息 → 0", async () => {
    const { status, body } = await call("GET", "/notifications/unread-count")
    expect(status).toBe(200)
    expect(dataOf(body)).toEqual({ count: 0 })
  })

  it("只统计未读且只统计本人", async () => {
    seedNotification()
    seedNotification()
    const read = seedNotification()
    getDrizzle()
      .update(notifications)
      .set({ isRead: 1, readTime: new Date().toISOString() })
      .where(eq(notifications.id, read.id))
      .run()
    // 别人的未读消息不计入
    seedNotification({ recipientId: OTHER.email })

    const { status, body } = await call("GET", "/notifications/unread-count")
    expect(status).toBe(200)
    expect(dataOf(body)).toEqual({ count: 2 })
  })
})

// ── POST /notifications/:id/read ────────────────────────────────────────────

describe("POST /notifications/:id/read 单条已读", () => {
  it("标记本人消息已读并返回更新后的 Notification", async () => {
    const seeded = seedNotification()
    const { status, body } = await call(
      "POST",
      `/notifications/${seeded.id}/read`
    )
    expect(status).toBe(200)
    const updated = dataOf<{ notification: Notification }>(body).notification
    expect(updated.id).toBe(seeded.id)
    expect(updated.isRead).toBe(1)
    expect(updated.readTime).not.toBeNull()
  })

  it("幂等：重复已读不刷新 readTime", async () => {
    const seeded = seedNotification()
    const first = await call("POST", `/notifications/${seeded.id}/read`)
    const firstReadTime = dataOf<{ notification: Notification }>(first.body)
      .notification.readTime
    expect(firstReadTime).not.toBeNull()

    await sleep(5)
    const second = await call("POST", `/notifications/${seeded.id}/read`)
    expect(second.status).toBe(200)
    const secondReadTime = dataOf<{ notification: Notification }>(second.body)
      .notification.readTime
    expect(secondReadTime).toBe(firstReadTime)
  })

  it("别人的消息 → 404 且不产生副作用", async () => {
    const others = seedNotification({ recipientId: OTHER.email })

    const { status, body } = await call(
      "POST",
      `/notifications/${others.id}/read`
    )
    expect(status).toBe(404)
    expect(body.code).toBe("NOTIFICATION_NOT_FOUND")

    const row = getDrizzle()
      .select()
      .from(notifications)
      .all()
      .find((n) => n.id === others.id)
    expect(row?.isRead).toBe(0)
    expect(row?.readTime).toBeNull()
  })

  it("不存在的 id → 404", async () => {
    const { status } = await call("POST", `/notifications/ghost-id/read`)
    expect(status).toBe(404)
  })
})

// ── POST /notifications/read-all ────────────────────────────────────────────

describe("POST /notifications/read-all 全部已读", () => {
  it("标记全部未读为已读，返回更新条数", async () => {
    seedNotification()
    seedNotification()
    seedNotification()

    const { status, body } = await call("POST", "/notifications/read-all")
    expect(status).toBe(200)
    expect(dataOf(body)).toEqual({ updated: 3 })

    const count = await call("GET", "/notifications/unread-count")
    expect(dataOf<{ count: number }>(count.body)).toEqual({ count: 0 })
  })

  it("已读消息不重复更新/计数", async () => {
    const read = seedNotification()
    getDrizzle()
      .update(notifications)
      .set({ isRead: 1, readTime: new Date().toISOString() })
      .where(eq(notifications.id, read.id))
      .run()
    seedNotification()

    const { body } = await call("POST", "/notifications/read-all")
    expect(dataOf(body)).toEqual({ updated: 1 })
  })

  it("?type= 只标记该业务类型（type 是不透明字符串）", async () => {
    seedNotification({ type: "approval" })
    seedNotification({ type: "approval" })
    const system = seedNotification({ type: "system" })

    const { body } = await call("POST", "/notifications/read-all?type=approval")
    expect(dataOf(body)).toEqual({ updated: 2 })

    const unread = await call("GET", "/notifications?unreadOnly=true")
    const remaining = dataOf<{ items: Notification[] }>(unread.body).items
    expect(remaining.map((n) => n.id)).toEqual([system.id])
  })

  it("type 为空白字符串 → 400，不会静默退化成全部已读", async () => {
    const mine = seedNotification()
    const { status, body } = await call(
      "POST",
      "/notifications/read-all?type=%20%20"
    )

    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
    // 仍然是未读
    const list = await call("GET", "/notifications")
    const item = dataOf<{ items: Notification[] }>(list.body).items.find(
      (n) => n.id === mine.id
    )
    expect(item?.isRead).toBe(0)
  })

  it("只影响本人收件箱", async () => {
    seedNotification()
    seedNotification({ recipientId: OTHER.email })

    await call("POST", "/notifications/read-all")

    const otherUnread = getDrizzle()
      .select()
      .from(notifications)
      .all()
      .filter((n) => n.recipientId === OTHER.email && n.isRead === 0)
    expect(otherUnread).toHaveLength(1)
  })
})

// ── DELETE /notifications/:id ───────────────────────────────────────────────

describe("DELETE /notifications/:id 删除", () => {
  it("删除本人消息 → 200，列表中不再出现", async () => {
    const seeded = seedNotification()
    const { status, body } = await call("DELETE", `/notifications/${seeded.id}`)
    expect(status).toBe(200)
    expect(dataOf(body)).toEqual({ deleted: true })

    const list = await call("GET", "/notifications")
    expect(dataOf<{ items: Notification[] }>(list.body).items).toHaveLength(0)
  })

  it("删除不存在的消息 → 404（重复删除）", async () => {
    const seeded = seedNotification()
    await call("DELETE", `/notifications/${seeded.id}`)
    const second = await call("DELETE", `/notifications/${seeded.id}`)
    expect(second.status).toBe(404)
  })

  it("别人的消息 → 404 且仍存在", async () => {
    const others = seedNotification({ recipientId: OTHER.email })
    const { status, body } = await call("DELETE", `/notifications/${others.id}`)
    expect(status).toBe(404)
    expect(body.code).toBe("NOTIFICATION_NOT_FOUND")

    const stillThere = getDrizzle()
      .select()
      .from(notifications)
      .all()
      .some((n) => n.id === others.id)
    expect(stillThere).toBe(true)
  })
})

// ── dev-only 造数端点 ────────────────────────────────────────────────────────

describe("POST /notifications/dev/push（dev-only）", () => {
  it("开发环境：给当前用户写入一条示例消息并返回", async () => {
    expect(env.NODE_ENV).not.toBe("production")
    const { status, body } = await call("POST", "/notifications/dev/push")
    expect(status).toBe(200)
    const notification = dataOf<{ notification: Notification }>(
      body
    ).notification
    expect(notification.recipientId).toBe(ME.email)
    expect(notification.title).toBe("开发环境测试消息")

    const list = await call("GET", "/notifications")
    expect(dataOf<{ items: Notification[] }>(list.body).items).toHaveLength(1)
  })

  it("生产环境：404，不暴露造数入口", async () => {
    const original = env.NODE_ENV
    try {
      ;(env as unknown as { NODE_ENV: string }).NODE_ENV = "production"
      const { status, body } = await call("POST", "/notifications/dev/push")
      expect(status).toBe(404)
      expect(body.success).toBe(false)
    } finally {
      ;(env as unknown as { NODE_ENV: string }).NODE_ENV = original
    }
  })
})

// ── demo reset ──────────────────────────────────────────────────────────────

describe("POST /notifications/dev/reset（demo-only）", () => {
  it("test 环境：恢复 7 条演示消息（4 未读 / 3 已读）", async () => {
    // 先制造脏状态：全读 + 删除一条
    seedNotification()
    getDrizzle()
      .update(notifications)
      .set({ isRead: 1, readTime: new Date().toISOString() })
      .run()

    const { status, body } = await call("POST", "/notifications/dev/reset")
    expect(status).toBe(200)
    expect(dataOf<{ inserted: number }>(body).inserted).toBe(7)

    // 演示消息的收件人是固定 admin（JWT sub），测试 token 用户看不到，直接查库断言
    const demoRows = getDrizzle()
      .select()
      .from(notifications)
      .all()
      .filter((row) => row.id.startsWith("seed-notification-"))
    expect(demoRows).toHaveLength(7)
    expect(demoRows.filter((row) => row.isRead === 0)).toHaveLength(4)
  })

  it("生产环境：404，不暴露演示重置入口", async () => {
    const original = env.NODE_ENV
    try {
      ;(env as unknown as { NODE_ENV: string }).NODE_ENV = "production"
      const { status } = await call("POST", "/notifications/dev/reset")
      expect(status).toBe(404)
    } finally {
      ;(env as unknown as { NODE_ENV: string }).NODE_ENV = original
    }
  })
})

// ── SSE ─────────────────────────────────────────────────────────────────────

describe("GET /notifications/stream（SSE）", () => {
  it("心跳间隔需小于 Bun idleTimeout（120s）", () => {
    expect(NOTIFICATION_STREAM_HEARTBEAT_MS).toBe(25_000)
    expect(NOTIFICATION_STREAM_HEARTBEAT_MS).toBeLessThan(120_000)
  })

  it("建连后收到通知事件（事件名 + Notification JSON），断开后取消订阅", async () => {
    expect(notificationBus.listenerCount(ME.email)).toBe(0)

    const controller = new AbortController()
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

    try {
      // 有界建连：流式响应本身应立即返回
      const res = await withTimeout(
        Promise.resolve(
          app.request("/notifications/stream", {
            headers: { Authorization: `Bearer ${meToken}` },
            signal: controller.signal,
          })
        ),
        2000,
        "SSE 建连"
      )
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type") ?? "").toContain(
        "text/event-stream"
      )
      expect(res.body).not.toBeNull()

      reader = res.body!.getReader()
      const decoder = new TextDecoder()
      const state = { buffer: "" }

      // 首个注释行确认订阅已建立
      const connected = await readSseUntil(
        reader,
        decoder,
        state,
        ": connected\n\n"
      )
      expect(connected).toContain(": connected")
      expect(notificationBus.listenerCount(ME.email)).toBe(1)

      // 落库 + publish（notify 内部保证先落库后推送）
      const published = notify({
        recipientId: ME.email,
        type: "announcement",
        title: "SSE 实时消息",
        content: "hello",
        payload: { href: "/components/notifications" },
      })
      expect(published).not.toBeNull()

      // 有界读取首个事件（不会挂住）
      const eventChunk = await readSseUntil(reader, decoder, state, "\n\n")
      expect(eventChunk).toContain(`event: ${NOTIFICATION_STREAM_EVENT}`)

      const dataLine = eventChunk
        .split("\n")
        .find((line) => line.startsWith("data: "))
      expect(dataLine).toBeDefined()
      const received = NotificationSchema.parse(
        JSON.parse(dataLine!.slice("data: ".length))
      )
      expect(received.id).toBe(published!.id)
      expect(received.title).toBe("SSE 实时消息")
      expect(received.payload).toEqual({ href: "/components/notifications" })

      // 真实断连（abort 请求 signal）后订阅必须被清理；
      // 在 reader.cancel() 之前断言，避免 cancel 自己触发 cleanup 造成假绿
      controller.abort()
      await withTimeout(
        (async () => {
          while (notificationBus.listenerCount(ME.email) !== 0) await sleep(10)
        })(),
        2000,
        "SSE 断开后订阅清理"
      )
      expect(notificationBus.listenerCount(ME.email)).toBe(0)
    } finally {
      // 无论断言成败都要断开，避免测试进程挂住/监听器泄漏
      controller.abort()
      await reader?.cancel().catch(() => {})
    }
  })
})

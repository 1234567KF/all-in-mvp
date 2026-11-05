/**
 * modules/log 集成测试（GET /logs 只读查询）
 *
 * 覆盖：鉴权（401 / 无 audit:view → 403）、默认分页、多维筛选（module / eventType /
 * result / severity / keyword / 时间范围）、LIKE 通配符转义、changes JSON 解析、
 * nullable 列兜底，以及非法筛选值 400。
 *
 * 运行方式：bun test src/modules/log/log.route.test.ts
 */
import { beforeAll, describe, expect, it } from "bun:test"
import { Hono } from "hono"
import jwt from "jsonwebtoken"
import { AuditLogSchema } from "shared"

import { getDrizzle } from "../../db.js"
import { auditLogs } from "../../db/schema.js"
import { JWT_SECRET } from "../../middleware/auth.js"
import { setupTestDb } from "../../test-helpers.js"
import logsRoute from "./log.route.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────
// 时间刻意递增，断言「createTime 倒序」无需排序容错。
type LogSeed = typeof auditLogs.$inferInsert

const LOGS: LogSeed[] = [
  {
    id: "log-1",
    createTime: "2026-01-01T10:00:00.000Z",
    module: "user",
    eventType: "update",
    operator: "Admin",
    operatorAccount: "admin",
    target: "Admin",
    targetId: "1",
    result: "success",
    severity: "info",
    detail: "姓名: 旧 → 新",
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    requestId: "req-1",
    changes: JSON.stringify({ 姓名: { before: "旧", after: "新" } }),
  },
  {
    id: "log-2",
    createTime: "2026-01-02T10:00:00.000Z",
    module: "system",
    eventType: "login",
    operator: "ghost",
    operatorAccount: "ghost@example.com",
    target: "ghost@example.com",
    result: "failure",
    severity: "warning",
    detail: "登录失败：用户不存在",
    changes: null,
  },
  {
    id: "log-3",
    createTime: "2026-01-03T10:00:00.000Z",
    module: "user",
    eventType: "delete",
    operator: "Admin",
    operatorAccount: "admin",
    target: "完成率 100%",
    result: "success",
    severity: "warning",
    detail: "删除用户：完成率 100%",
    changes: JSON.stringify({
      snapshot: { before: { name: "旧用户" }, after: null },
    }),
  },
  {
    id: "log-4",
    createTime: "2026-01-04T10:00:00.000Z",
    module: "user",
    eventType: "create",
    target: "无操作人",
    result: "success",
    severity: "info",
    // operator / changes 缺省 → 验证 nullable 列兜底
  },
  {
    id: "log-5",
    createTime: "2026-01-05T10:00:00.000Z",
    module: "system",
    eventType: "update",
    operator: "Admin",
    operatorAccount: "admin",
    target: "系统配置",
    result: "success",
    severity: "info",
    changes: JSON.stringify({ 配置: { before: "a", after: "b" } }),
  },
]

let app: Hono
let adminToken: string
let userToken: string

function signToken(role: string) {
  return jwt.sign({ sub: "admin", username: "Admin", role }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  })
}

beforeAll(() => {
  setupTestDb()
  getDrizzle().insert(auditLogs).values(LOGS).run()

  app = new Hono()
  app.route("/logs", logsRoute)
  adminToken = signToken("admin")
  userToken = signToken("user")
})

interface LogsBody {
  items: Array<Record<string, unknown>>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

async function getLogs(
  query: string,
  token: string = adminToken
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.request(`/logs${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: res.status, body: await res.json() }
}

async function getLogsData(query = ""): Promise<LogsBody> {
  const { status, body } = await getLogs(query)
  expect(status).toBe(200)
  return body.data as LogsBody
}

function ids(data: LogsBody): string[] {
  return data.items.map((item) => item.id as string)
}

// ── 鉴权 ──────────────────────────────────────────────────────────────────────

describe("GET /logs 鉴权", () => {
  it("无 token → 401", async () => {
    const res = await app.request("/logs")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("无 audit:view 权限（user 角色）→ 403", async () => {
    const { status, body } = await getLogs("", userToken)
    expect(status).toBe(403)
    expect(body.code).toBe("FORBIDDEN")
  })
})

// ── 分页 ──────────────────────────────────────────────────────────────────────

describe("GET /logs 分页", () => {
  it("默认 page=1 / pageSize=20，createTime 倒序", async () => {
    const data = await getLogsData()
    expect(data.total).toBe(5)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(20)
    expect(data.totalPages).toBe(1)
    expect(ids(data)).toEqual(["log-5", "log-4", "log-3", "log-2", "log-1"])
  })

  it("pageSize + page 组合：切页与 totalPages 正确", async () => {
    const page2 = await getLogsData("?page=2&pageSize=2")
    expect(page2.total).toBe(5)
    expect(page2.totalPages).toBe(3)
    expect(ids(page2)).toEqual(["log-3", "log-2"])

    const page3 = await getLogsData("?page=3&pageSize=2")
    expect(ids(page3)).toEqual(["log-1"])
  })

  it("空参数视为未传（?page=&pageSize=）", async () => {
    const data = await getLogsData("?page=&pageSize=")
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(20)
  })
})

// ── 筛选 ──────────────────────────────────────────────────────────────────────

describe("GET /logs 筛选", () => {
  it("module / eventType / result / severity 精确筛选", async () => {
    expect(ids(await getLogsData("?module=user"))).toEqual([
      "log-4",
      "log-3",
      "log-1",
    ])
    expect(ids(await getLogsData("?eventType=login"))).toEqual(["log-2"])
    expect(ids(await getLogsData("?result=failure"))).toEqual(["log-2"])
    expect(ids(await getLogsData("?severity=warning"))).toEqual([
      "log-3",
      "log-2",
    ])
  })

  it("keyword 模糊匹配操作人 / 账号 / 对象 / 详情", async () => {
    expect(ids(await getLogsData("?keyword=ghost"))).toEqual(["log-2"])
    expect(ids(await getLogsData("?keyword=Admin"))).toEqual([
      "log-5",
      "log-3",
      "log-1",
    ])
  })

  it("keyword 中的 % 按字面量匹配（LIKE 通配符已转义）", async () => {
    const data = await getLogsData(`?keyword=${encodeURIComponent("100%")}`)
    expect(ids(data)).toEqual(["log-3"])

    const percentOnly = await getLogsData(`?keyword=${encodeURIComponent("%")}`)
    expect(ids(percentOnly)).toEqual(["log-3"])
  })

  it("时间范围筛选（含边界）", async () => {
    const data = await getLogsData(
      "?startTime=2026-01-03T00:00:00.000Z&endTime=2026-01-04T23:59:59.999Z"
    )
    expect(ids(data)).toEqual(["log-4", "log-3"])
  })

  it("非法枚举筛选值 → 400 VALIDATION_ERROR", async () => {
    const { status, body } = await getLogs(`?result=ok`)
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
  })
})

// ── wire 形状 ─────────────────────────────────────────────────────────────────

describe("GET /logs wire 形状", () => {
  it("changes JSON 字符串解析为结构化对象（含 snapshot 形）", async () => {
    const data = await getLogsData()
    const log1 = data.items.find((item) => item.id === "log-1")!
    expect(log1.changes).toEqual({ 姓名: { before: "旧", after: "新" } })

    const log3 = data.items.find((item) => item.id === "log-3")!
    expect(log3.changes).toEqual({
      snapshot: { before: { name: "旧用户" }, after: null },
    })
  })

  it("nullable 列按空串兜底，changes 缺省为 null", async () => {
    const data = await getLogsData()
    const log4 = data.items.find((item) => item.id === "log-4")!
    expect(log4.operator).toBe("")
    expect(log4.operatorAccount).toBe("")
    expect(log4.changes).toBeNull()
  })
})

// ── 时间参数契约 ──────────────────────────────────────────────────────────────

describe("GET /logs 时间参数", () => {
  it("date-only 归一化为 UTC 日边界（start 含边界）", async () => {
    const data = await getLogsData("?startTime=2026-01-03")
    expect(ids(data)).toEqual(["log-5", "log-4", "log-3"])
  })

  it("date-only endTime 归一化为当日 23:59:59.999（end 含边界）", async () => {
    const data = await getLogsData("?endTime=2026-01-02")
    expect(ids(data)).toEqual(["log-2", "log-1"])
  })

  it("非法时间格式 → 400，不再静默返回空列表", async () => {
    for (const query of ["?startTime=WTF", "?endTime=2026/01/03"]) {
      const { status, body } = await getLogs(query)
      expect({ query, status }).toEqual({ query, status: 400 })
      expect(body.code).toBe("VALIDATION_ERROR")
    }
  })

  it("格式合法但日历越界 → 400（而非 RangeError 触发的 500）", async () => {
    for (const query of [
      "?startTime=2026-13-45T10:00:00Z",
      "?startTime=2026-01-01T25:99:00Z",
      "?startTime=2026-02-30T00:00:00Z",
      "?startTime=2026-99-99",
    ]) {
      const { status, body } = await getLogs(query)
      expect({ query, status }).toEqual({ query, status: 400 })
      expect(body.code).toBe("VALIDATION_ERROR")
    }
  })

  it("开始时间晚于结束时间 → 400", async () => {
    const { status, body } = await getLogs(
      "?startTime=2026-01-05&endTime=2026-01-01"
    )
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
  })
})

// ── LIKE 通配符字面量 ────────────────────────────────────────────────────────

describe("GET /logs keyword 通配符转义", () => {
  it("下划线 / 反斜杠按字面量匹配（不会被 LIKE 通配放大）", async () => {
    // fixtures 中不存在 "_" / "\\"；未转义时 "_" 会匹配任意单字符 → 返回全部 5 条
    expect(ids(await getLogsData("?keyword=_"))).toEqual([])
    expect(
      ids(await getLogsData(`?keyword=${encodeURIComponent("\\")}`))
    ).toEqual([])
  })
})

// ── 数据健壮性 / 稳定排序（放最后：会追加 fixtures）──────────────────────────

describe("GET /logs 数据健壮性与稳定排序", () => {
  beforeAll(() => {
    getDrizzle()
      .insert(auditLogs)
      .values([
        // 坏 changes：坏 JSON / snapshot 为 null / 字段值不是 {before,after}
        {
          id: "bad-1",
          createTime: "2026-01-06T10:00:00.000Z",
          module: "user",
          eventType: "update",
          target: "坏JSON",
          result: "success",
          severity: "info",
          changes: "not-json",
        },
        {
          id: "bad-2",
          createTime: "2026-01-06T10:00:01.000Z",
          module: "user",
          eventType: "update",
          target: "坏快照",
          result: "success",
          severity: "info",
          changes: JSON.stringify({ snapshot: null }),
        },
        {
          id: "bad-3",
          createTime: "2026-01-06T10:00:02.000Z",
          module: "user",
          eventType: "update",
          target: "坏结构",
          result: "success",
          severity: "info",
          changes: JSON.stringify({ 字段: "文本" }),
        },
        // 同 createTime 多行：验证 id tiebreaker（offset 分页需全序）
        {
          id: "tie-a",
          createTime: "2026-01-07T10:00:00.000Z",
          module: "user",
          eventType: "update",
          target: "tie排序",
          result: "success",
          severity: "info",
        },
        {
          id: "tie-b",
          createTime: "2026-01-07T10:00:00.000Z",
          module: "user",
          eventType: "update",
          target: "tie排序",
          result: "success",
          severity: "info",
        },
      ])
      .run()
  })

  it("坏 changes 统一返回 null，不影响整页查询", async () => {
    const data = await getLogsData("?keyword=坏")
    expect(data.total).toBe(3)
    for (const item of data.items) {
      expect(item.changes).toBeNull()
    }
  })

  it("items 全部通过 shared AuditLogSchema 校验（wire 契约不漂移）", async () => {
    const data = await getLogsData("?pageSize=100")
    expect(data.items.length).toBeGreaterThan(0)
    for (const item of data.items) {
      expect(AuditLogSchema.safeParse(item).success, JSON.stringify(item)).toBe(
        true
      )
    }
  })

  it("同 createTime 多行按 id 倒序稳定排序", async () => {
    const data = await getLogsData("?keyword=tie")
    expect(ids(data)).toEqual(["tie-b", "tie-a"])
  })
})

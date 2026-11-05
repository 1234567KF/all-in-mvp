import { afterEach, describe, expect, it, vi } from "vitest"

import {
  formatDate,
  formatRelativeTime,
  formatTimestamp,
  getLocalDayBoundaryISO,
  parseDateString,
} from "@/lib/date-utils"

afterEach(() => vi.useRealTimers())

describe("formatRelativeTime", () => {
  it("returns '刚刚' when diff < 1 minute", () => {
    vi.useFakeTimers({ now: new Date("2025-06-01T12:00:00Z") })
    expect(formatRelativeTime("2025-06-01T11:59:30Z")).toBe("刚刚")
  })

  it("returns 'N分钟前' when diff < 60 minutes", () => {
    vi.useFakeTimers({ now: new Date("2025-06-01T12:00:00Z") })
    const result = formatRelativeTime("2025-06-01T11:50:00Z")
    expect(result).toContain("10")
    expect(result).toMatch(/分钟前|minute/)
  })

  it("returns 'N小时前' when diff < 24 hours", () => {
    vi.useFakeTimers({ now: new Date("2025-06-01T12:00:00Z") })
    const result = formatRelativeTime("2025-06-01T09:00:00Z")
    expect(result).toContain("3")
    expect(result).toMatch(/小时前|hour/)
  })

  it("returns 'N天前' when diff < 7 days", () => {
    vi.useFakeTimers({ now: new Date("2025-06-10T12:00:00Z") })
    const result = formatRelativeTime("2025-06-08T12:00:00Z")
    expect(result).toContain("2")
    expect(result).toMatch(/天前|day/)
  })

  it("returns M/D format when diff >= 7 days", () => {
    vi.useFakeTimers({ now: new Date("2025-06-20T12:00:00Z") })
    const result = formatRelativeTime("2025-06-01T12:00:00Z")
    expect(result).toBe("6/1")
  })

  it("supports English locale", () => {
    vi.useFakeTimers({ now: new Date("2025-06-01T12:00:00Z") })
    expect(formatRelativeTime("2025-06-01T11:59:30Z", "en-US")).toBe("just now")
  })

  it("returns '-' for invalid date instead of NaN", () => {
    expect(formatRelativeTime("not-a-date")).toBe("-")
    expect(formatRelativeTime("")).toBe("-")
    // 非法 createdAt 曾输出 "NaN/NaN"，不能回归
    expect(formatRelativeTime("not-a-date")).not.toContain("NaN")
  })

  it("still formats valid far-past dates via M/D after the guard", () => {
    vi.useFakeTimers({ now: new Date("2025-06-20T12:00:00Z") })
    expect(formatRelativeTime("2024-12-31T12:00:00Z")).toBe("12/31")
  })
})

describe("formatTimestamp", () => {
  it("returns '-' for null", () => {
    expect(formatTimestamp(null)).toBe("-")
  })

  it("returns original value for invalid date string", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date")
  })

  it("formats a valid ISO string — local format, no raw ISO markers", () => {
    const result = formatTimestamp("2025-06-15T08:30:45.000Z")
    // 不应包含 ISO 原始标记（T 分隔符、Z 时区后缀、毫秒点）
    expect(result).not.toMatch(/[TZ]/)
    expect(result).not.toContain(".")
    // 应包含日期和时间组件（本地格式）
    expect(result).toMatch(/\d{4}/) // 4位年份
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/) // HH:mm:ss（24小时制）
    // 具体日期值（08:30 UTC 在大多数时区仍为 6/15）
    expect(result).toContain("2025")
    expect(result).toContain("06")
    expect(result).toContain("15")
  })

  it("accepts numeric timestamp — local format, no raw ISO markers", () => {
    const ts = new Date("2025-01-01T00:00:00Z").getTime()
    const result = formatTimestamp(ts)
    expect(result).not.toMatch(/[TZ]/)
    expect(result).not.toContain(".")
    expect(result).toMatch(/\d{4}/)
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
  })
})

describe("formatDate", () => {
  it("returns '-' for null", () => {
    expect(formatDate(null)).toBe("-")
  })

  it("returns original value for invalid date", () => {
    expect(formatDate("invalid")).toBe("invalid")
  })

  it("formats ISO string as YYYY-MM-DD", () => {
    expect(formatDate("2025-03-05T10:00:00Z")).toBe("2025-03-05")
  })

  it("pads single-digit month and day", () => {
    expect(formatDate("2025-01-09T00:00:00Z")).toBe("2025-01-09")
  })

  it("accepts numeric timestamp", () => {
    const ts = new Date("2025-12-25T00:00:00Z").getTime()
    expect(formatDate(ts)).toBe("2025-12-25")
  })
})

describe("parseDateString", () => {
  it("解析 YYYY-MM-DD（统一换为 / 分隔，按本地时间）", () => {
    const d = parseDateString("2025-03-05")
    expect(d).toBeInstanceOf(Date)
    expect(d?.getFullYear()).toBe(2025)
    expect(d?.getMonth()).toBe(2) // March
    expect(d?.getDate()).toBe(5)
  })

  it("解析 YYYY/MM/DD", () => {
    const d = parseDateString("2025/12/31")
    expect(d?.getFullYear()).toBe(2025)
    expect(d?.getMonth()).toBe(11)
    expect(d?.getDate()).toBe(31)
  })

  it("空字符串或无效输入返回 undefined", () => {
    expect(parseDateString("")).toBeUndefined()
    expect(parseDateString("not-a-date")).toBeUndefined()
  })
})

describe("getLocalDayBoundaryISO", () => {
  // 将本地 Date 构造 → ISO 后反解回 Date 验证“本地日界”属性，
  // 避免测试在不同时区 CI 上产生不同结果。
  it("start boundary —— 本地当天 00:00:00.000", () => {
    const input = new Date(2026, 6, 10, 15, 30, 45, 123) // 本地 2026-07-10 15:30:45.123
    const iso = getLocalDayBoundaryISO(input, "start")
    const back = new Date(iso)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(6) // July
    expect(back.getDate()).toBe(10)
    expect(back.getHours()).toBe(0)
    expect(back.getMinutes()).toBe(0)
    expect(back.getSeconds()).toBe(0)
    expect(back.getMilliseconds()).toBe(0)
  })

  it("end boundary —— 本地当天 23:59:59.999", () => {
    const input = new Date(2026, 6, 11, 0, 0, 0, 0)
    const iso = getLocalDayBoundaryISO(input, "end")
    const back = new Date(iso)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(6)
    expect(back.getDate()).toBe(11)
    expect(back.getHours()).toBe(23)
    expect(back.getMinutes()).toBe(59)
    expect(back.getSeconds()).toBe(59)
    expect(back.getMilliseconds()).toBe(999)
  })

  it("跨月边界不会溢出（end 仍在本月末）", () => {
    const input = new Date(2026, 0, 31, 12, 0, 0, 0) // 2026-01-31
    const iso = getLocalDayBoundaryISO(input, "end")
    const back = new Date(iso)
    expect(back.getMonth()).toBe(0) // January
    expect(back.getDate()).toBe(31)
    expect(back.getHours()).toBe(23)
  })

  it("非 midnight 输入不影响结果（只看 y/m/d）", () => {
    const a = new Date(2026, 6, 15, 0, 0, 0, 0)
    const b = new Date(2026, 6, 15, 18, 45, 30, 500)
    expect(getLocalDayBoundaryISO(a, "start")).toBe(
      getLocalDayBoundaryISO(b, "start")
    )
    expect(getLocalDayBoundaryISO(a, "end")).toBe(
      getLocalDayBoundaryISO(b, "end")
    )
  })
})

/**
 * date-utils 测试 — 重点守住"本地时区"这条不变量
 *
 * 存在意义（WHY，不只是 WHAT）：本项目反复出现 `toISOString().slice(0, 10)`
 * 取日期导致 UTC+ 时区往前挪一天的事故（见 eslint-rules/no-toisostring-slice.js）。
 * 下面所有断言都用「本地构造 → 本地读回」的方式表达，因此在任何时区的 CI 上都成立；
 * 一旦 formatDate / getLocalDayBoundaryISO 改成按 UTC 计算，断言立刻失败。
 */

import { describe, expect, it } from "vitest"

import { formatDate, getLocalDayBoundaryISO } from "@/lib/date-utils"

describe("formatDate", () => {
  it("null / undefined 统一返回破折号占位", () => {
    expect(formatDate(null)).toBe("-")
    expect(formatDate(undefined)).toBe("-")
  })

  it("非法输入原样返回，不抛异常（列表页脏数据不能白屏）", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date")
  })

  it("输出 YYYY-MM-DD，月/日补零", () => {
    expect(formatDate("2026-01-05T00:30:00")).toBe("2026-01-05")
  })

  it("本地当天凌晨仍属于同一天 —— 这正是 toISOString().slice 会算错的情形", () => {
    const d = new Date(2026, 6, 9, 0, 30, 0) // 本地 2026-07-09 00:30
    expect(formatDate(d.getTime())).toBe("2026-07-09")
  })

  it("接受 Date 对象与数字时间戳两种入参形态", () => {
    const d = new Date(2026, 11, 1, 13, 0, 0)
    expect(formatDate(d)).toBe("2026-12-01")
    expect(formatDate(d.getTime())).toBe("2026-12-01")
  })
})

describe("getLocalDayBoundaryISO", () => {
  it("start 边界回读为本地 00:00:00.000，且仍落在同一天", () => {
    const iso = getLocalDayBoundaryISO(new Date(2026, 6, 9, 15, 40), "start")
    const back = new Date(iso)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(6)
    expect(back.getDate()).toBe(9)
    expect([back.getHours(), back.getMinutes(), back.getSeconds(), back.getMilliseconds()]).toEqual([0, 0, 0, 0])
  })

  it("end 边界回读为本地 23:59:59.999，用于日期范围查询不漏最后一天", () => {
    const iso = getLocalDayBoundaryISO(new Date(2026, 6, 9, 8, 0), "end")
    const back = new Date(iso)
    expect(back.getDate()).toBe(9)
    expect([back.getHours(), back.getMinutes(), back.getSeconds(), back.getMilliseconds()]).toEqual([23, 59, 59, 999])
  })

  it("返回完整 ISO 串（含时区信息），不是被截断的日期串", () => {
    expect(getLocalDayBoundaryISO(new Date(2026, 0, 1), "start")).toMatch(
      /T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/
    )
  })
})

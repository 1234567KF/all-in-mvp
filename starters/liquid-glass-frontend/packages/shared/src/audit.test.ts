import { describe, expect, it } from "vitest"

import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_EVENT_TYPE_OPTIONS,
  AUDIT_EVENT_TYPES,
  AUDIT_MODULE_LABELS,
  AUDIT_MODULE_OPTIONS,
  AUDIT_MODULES,
  AUDIT_RESULT,
  AUDIT_RESULT_LABELS,
  AUDIT_RESULT_OPTIONS,
  AUDIT_SEVERITY,
  AUDIT_SEVERITY_LABELS,
  AUDIT_SEVERITY_OPTIONS,
  AuditChangesSchema,
  type AuditLog,
  AuditLogQuerySchema,
  AuditLogSchema,
  MODULE_EVENT_TYPES,
} from "./audit.js"

// ─── 事件类型与 label 一致性 ──────────────────────────────────────────────────

describe("AUDIT_EVENT_TYPE_LABELS 一致性", () => {
  it("每个事件类型都有非空 label", () => {
    for (const eventType of Object.values(AUDIT_EVENT_TYPES)) {
      expect(
        AUDIT_EVENT_TYPE_LABELS[eventType],
        `事件类型 ${eventType} 缺少 label`
      ).toBeTruthy()
    }
  })

  it("label 无冗余键（键集合与事件类型集合完全一致）", () => {
    expect(Object.keys(AUDIT_EVENT_TYPE_LABELS).sort()).toEqual(
      Object.values(AUDIT_EVENT_TYPES).sort()
    )
  })

  it("事件类型值无重复", () => {
    const values = Object.values(AUDIT_EVENT_TYPES)
    expect(new Set(values).size).toBe(values.length)
  })
})

// ─── 模块与 label 一致性 ──────────────────────────────────────────────────────

describe("AUDIT_MODULE_LABELS 一致性", () => {
  it("每个模块都有非空 label 且无冗余键", () => {
    expect(Object.keys(AUDIT_MODULE_LABELS).sort()).toEqual(
      Object.values(AUDIT_MODULES).sort()
    )
    for (const label of Object.values(AUDIT_MODULE_LABELS)) {
      expect(label).toBeTruthy()
    }
  })
})

// ─── 审计结果 ─────────────────────────────────────────────────────────────────

describe("AUDIT_RESULT 一致性", () => {
  it("result 值为 success / failure 且 label 完整", () => {
    expect(Object.values(AUDIT_RESULT).sort()).toEqual(["failure", "success"])
    expect(Object.keys(AUDIT_RESULT_LABELS).sort()).toEqual(
      Object.values(AUDIT_RESULT).sort()
    )
  })
})

// ─── 严重程度 ─────────────────────────────────────────────────────────────────

describe("AUDIT_SEVERITY 一致性", () => {
  it("severity 值为四档且 label 完整", () => {
    expect(Object.values(AUDIT_SEVERITY).sort()).toEqual([
      "critical",
      "error",
      "info",
      "warning",
    ])
    expect(Object.keys(AUDIT_SEVERITY_LABELS).sort()).toEqual(
      Object.values(AUDIT_SEVERITY).sort()
    )
    for (const label of Object.values(AUDIT_SEVERITY_LABELS)) {
      expect(label).toBeTruthy()
    }
  })
})

// ─── 筛选选项 ─────────────────────────────────────────────────────────────────

describe("筛选选项常量", () => {
  it("模块 / 事件类型选项与常量一一对应", () => {
    expect([...AUDIT_MODULE_OPTIONS].sort()).toEqual(
      Object.values(AUDIT_MODULES).sort()
    )
    expect([...AUDIT_EVENT_TYPE_OPTIONS].sort()).toEqual(
      Object.values(AUDIT_EVENT_TYPES).sort()
    )
  })

  it("结果 / 严重程度选项与常量一一对应", () => {
    expect([...AUDIT_RESULT_OPTIONS].sort()).toEqual(
      Object.values(AUDIT_RESULT).sort()
    )
    expect([...AUDIT_SEVERITY_OPTIONS].sort()).toEqual(
      Object.values(AUDIT_SEVERITY).sort()
    )
  })

  it("MODULE_EVENT_TYPES 键为已知模块、值为已知事件类型", () => {
    const validModules = new Set(Object.values(AUDIT_MODULES))
    const validEventTypes = new Set(Object.values(AUDIT_EVENT_TYPES))
    for (const [module, eventTypes] of Object.entries(MODULE_EVENT_TYPES)) {
      expect(validModules.has(module as never), `未知模块 ${module}`).toBe(true)
      for (const eventType of eventTypes) {
        expect(
          validEventTypes.has(eventType),
          `模块 ${module} 的事件类型 ${eventType} 未登记`
        ).toBe(true)
      }
    }
  })
})

// ─── 查询契约 ─────────────────────────────────────────────────────────────────

describe("AuditLogQuerySchema", () => {
  it("空查询使用默认分页（page=1 / pageSize=20）", () => {
    expect(AuditLogQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
  })

  it("空串参数视为未传（?page=&keyword=&result=）", () => {
    expect(
      AuditLogQuerySchema.parse({ page: "", keyword: "", result: "" })
    ).toEqual({ page: 1, pageSize: 20 })
  })

  it("数字字符串自动强转并校验范围", () => {
    expect(AuditLogQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    })
    expect(AuditLogQuerySchema.safeParse({ page: "0" }).success).toBe(false)
    expect(AuditLogQuerySchema.safeParse({ pageSize: "101" }).success).toBe(
      false
    )
  })

  it("date-only 时间归一化为 UTC 日边界（start 00:00 / end 23:59）", () => {
    expect(
      AuditLogQuerySchema.parse({
        startTime: "2026-01-03",
        endTime: "2026-01-04",
      })
    ).toEqual({
      page: 1,
      pageSize: 20,
      startTime: "2026-01-03T00:00:00.000Z",
      endTime: "2026-01-04T23:59:59.999Z",
    })
  })

  it("完整 ISO 时间统一规范为 UTC（含时区偏移）", () => {
    expect(
      AuditLogQuerySchema.parse({ startTime: "2026-01-03T08:00:00+08:00" })
        .startTime
    ).toBe("2026-01-03T00:00:00.000Z")
  })

  it("无时区的 ISO 时间按 UTC 解释（避免本地时区歧义）", () => {
    expect(
      AuditLogQuerySchema.parse({ startTime: "2026-01-03T10:00:00" }).startTime
    ).toBe("2026-01-03T10:00:00.000Z")
  })

  it("非法时间格式 → 校验失败（不再静默返回空列表）", () => {
    for (const value of ["WTF", "2026/01/03", "1700000000000"]) {
      expect(
        AuditLogQuerySchema.safeParse({ startTime: value }).success,
        value
      ).toBe(false)
    }
  })

  it("格式合法但日历越界 → 校验失败（不抛 RangeError / 不静默进位）", () => {
    const invalidValues = [
      "2026-13-45T10:00:00Z", // 月份 / 日期越界（Date → Invalid → toISOString 会抛）
      "2026-01-01T25:99:00Z", // 时分越界
      "2026-02-30T00:00:00Z", // 平年 2 月 30（Date 会静默进位到 3-2）
      "2026-99-99", // date-only 越界（旧实现直接拼字符串放行）
      "2026-02-30", // date-only 平年 2 月 30
    ]
    for (const value of invalidValues) {
      let result: { success: boolean } | undefined
      expect(() => {
        result = AuditLogQuerySchema.safeParse({ startTime: value })
      }, value).not.toThrow()
      expect(result?.success, value).toBe(false)
    }
  })

  it("闰年合法日期照常接受", () => {
    expect(
      AuditLogQuerySchema.parse({ startTime: "2024-02-29" }).startTime
    ).toBe("2024-02-29T00:00:00.000Z")
  })

  it("开始时间晚于结束时间 → 校验失败", () => {
    const result = AuditLogQuerySchema.safeParse({
      startTime: "2026-01-05",
      endTime: "2026-01-01",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endTime"])
    }
  })

  it("result / severity 枚举校验：合法放行、非法拒绝", () => {
    expect(
      AuditLogQuerySchema.parse({ result: "failure", severity: "warning" })
    ).toEqual({
      page: 1,
      pageSize: 20,
      result: "failure",
      severity: "warning",
    })
    expect(AuditLogQuerySchema.safeParse({ result: "ok" }).success).toBe(false)
    expect(AuditLogQuerySchema.safeParse({ severity: "fatal" }).success).toBe(
      false
    )
  })
})

// ─── 日志 wire 契约 ──────────────────────────────────────────────────────────

describe("AuditLogSchema", () => {
  const baseLog: AuditLog = {
    id: "log-1",
    operator: "Admin",
    operatorId: "admin",
    operatorAccount: "admin",
    operatorRole: "admin",
    eventType: "update",
    module: "user",
    target: "Admin",
    targetId: "1",
    ipAddress: "127.0.0.1",
    result: "success",
    severity: "info",
    detail: "姓名: 旧 → 新",
    userAgent: "Mozilla/5.0",
    requestId: "req-1",
    changes: { 姓名: { before: "旧", after: "新" } },
    createTime: "2026-01-01T00:00:00.000Z",
  }

  it("解析完整行（changes 为结构化对象）", () => {
    expect(AuditLogSchema.parse(baseLog)).toEqual(baseLog)
  })

  it("changes 允许 null（登录等无变更字段的日志）", () => {
    expect(AuditLogSchema.parse({ ...baseLog, changes: null }).changes).toBe(
      null
    )
  })

  it("snapshot 形 changes（新增/删除快照）合法", () => {
    const snapshot = {
      ...baseLog,
      eventType: "create",
      changes: { snapshot: { before: null, after: { name: "新行" } } },
    }
    expect(AuditLogSchema.parse(snapshot).changes?.snapshot).toEqual({
      before: null,
      after: { name: "新行" },
    })
  })

  it("缺少 changes 键 → 拒绝（wire 固定包含该字段，null 表示无变更）", () => {
    const { changes: _changes, ...withoutChanges } = baseLog
    expect(AuditLogSchema.safeParse(withoutChanges).success).toBe(false)
  })
})

// ─── changes 结构契约 ────────────────────────────────────────────────────────

describe("AuditChangesSchema", () => {
  it("合法 diff / snapshot 形结构通过", () => {
    expect(
      AuditChangesSchema.safeParse({
        姓名: { before: "旧", after: "新" },
      }).success
    ).toBe(true)
    expect(
      AuditChangesSchema.safeParse({
        snapshot: { before: null, after: { name: "新行" } },
      }).success
    ).toBe(true)
  })

  it("坏结构拒绝（快照为 null / 字段值为字符串）", () => {
    expect(AuditChangesSchema.safeParse({ snapshot: null }).success).toBe(false)
    expect(AuditChangesSchema.safeParse({ 字段: "文本" }).success).toBe(false)
    expect(AuditChangesSchema.safeParse([1, 2, 3]).success).toBe(false)
  })
})

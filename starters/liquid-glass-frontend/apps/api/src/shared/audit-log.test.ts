/**
 * audit-log 基础设施测试
 * 运行方式：bun test src/shared/audit-log.test.ts
 */
import { beforeAll, describe, expect, it } from "bun:test"

import { getDrizzle } from "../db.js"
import { auditLogs } from "../db/schema.js"
import { setupTestDb } from "../test-helpers.js"
import {
  createAuditor,
  inferSeverity,
  normalizeIP,
  writeLog,
} from "./audit-log.js"

beforeAll(() => {
  setupTestDb()
})

// ─── normalizeIP ──────────────────────────────────────────────────────────────

describe("normalizeIP", () => {
  it("IPv6 loopback → 127.0.0.1", () => {
    expect(normalizeIP("::1")).toBe("127.0.0.1")
    expect(normalizeIP("::ffff:127.0.0.1")).toBe("127.0.0.1")
  })

  it("IPv4-mapped IPv6 → 提取 IPv4 部分", () => {
    expect(normalizeIP("::ffff:192.168.1.1")).toBe("192.168.1.1")
  })

  it("普通 IPv4 原样返回", () => {
    expect(normalizeIP("10.0.0.1")).toBe("10.0.0.1")
  })
})

// ─── inferSeverity ────────────────────────────────────────────────────────────

describe("inferSeverity", () => {
  it("删除 → warning", () => {
    expect(inferSeverity("delete")).toBe("warning")
  })

  it("权限变更 → warning", () => {
    expect(inferSeverity("permission_change")).toBe("warning")
  })

  it("修改密码 → warning", () => {
    expect(inferSeverity("change_pwd")).toBe("warning")
  })

  it("重置密码 → warning", () => {
    expect(inferSeverity("reset_pwd")).toBe("warning")
  })

  it("登录 → info", () => {
    expect(inferSeverity("login")).toBe("info")
  })

  it("未知 eventType → info（默认）", () => {
    expect(inferSeverity("自定义操作")).toBe("info")
    expect(inferSeverity("")).toBe("info")
  })
})

// ─── writeLog ─────────────────────────────────────────────────────────────────

describe("writeLog", () => {
  it("写入审计日志到 DB", () => {
    writeLog({
      operator: "测试员",
      operatorId: "u-test",
      operatorAccount: "test",
      operatorRole: "admin",
      module: "test_module",
      eventType: "create",
      target: "测试目标",
      targetId: "t-1",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      requestId: "req-001",
      detail: "测试详情",
    })

    const log = getDrizzle()
      .select()
      .from(auditLogs)
      .all()
      .find((l) => l.requestId === "req-001")

    expect(log).toBeDefined()
    expect(log!.operator).toBe("测试员")
    expect(log!.operatorId).toBe("u-test")
    expect(log!.module).toBe("test_module")
    expect(log!.eventType).toBe("create")
    expect(log!.target).toBe("测试目标")
    expect(log!.targetId).toBe("t-1")
    expect(log!.ipAddress).toBe("127.0.0.1")
    expect(log!.detail).toBe("测试详情")
    expect(log!.result).toBe("success") // 默认值
    expect(log!.severity).toBe("info") // 创建 → inferSeverity → info
  })

  it("severity 可覆盖", () => {
    writeLog({
      operator: "admin",
      operatorRole: "admin",
      module: "m",
      eventType: "login",
      target: "t",
      severity: "warning",
      requestId: "req-sev",
    })

    const log = getDrizzle()
      .select()
      .from(auditLogs)
      .all()
      .find((l) => l.requestId === "req-sev")

    expect(log!.severity).toBe("warning")
  })

  it("changes 序列化为 JSON 字符串", () => {
    const changes = { name: { before: "旧", after: "新" } }
    writeLog({
      operator: "admin",
      operatorRole: "admin",
      module: "m",
      eventType: "update",
      target: "t",
      changes,
      requestId: "req-changes",
    })

    const log = getDrizzle()
      .select()
      .from(auditLogs)
      .all()
      .find((l) => l.requestId === "req-changes")

    expect(JSON.parse(log!.changes ?? "")).toEqual(changes)
  })

  it("无 changes 时存空字符串", () => {
    writeLog({
      operator: "admin",
      operatorRole: "admin",
      module: "m",
      eventType: "logout",
      target: "t",
      requestId: "req-no-changes",
    })

    const log = getDrizzle()
      .select()
      .from(auditLogs)
      .all()
      .find((l) => l.requestId === "req-no-changes")

    expect(log!.changes).toBe("")
  })
})

// ─── createAuditor ────────────────────────────────────────────────────────────

describe("createAuditor", () => {
  it("返回的 audit 函数正确写入日志", () => {
    const audit = createAuditor("user")

    audit(
      {
        operator: "操作员",
        operatorId: "u-op",
        operatorAccount: "op1",
        operatorRole: "user",
        ipAddress: "10.0.0.1",
        userAgent: "chrome",
        requestId: "req-auditor",
      },
      {
        eventType: "change_pwd",
        target: "alice@example.com",
        targetId: "u-1",
        detail: "用户自助修改密码",
      }
    )

    const log = getDrizzle()
      .select()
      .from(auditLogs)
      .all()
      .find((l) => l.requestId === "req-auditor")

    expect(log).toBeDefined()
    expect(log!.module).toBe("user")
    expect(log!.eventType).toBe("change_pwd")
    expect(log!.target).toBe("alice@example.com")
    expect(log!.operator).toBe("操作员")
    expect(log!.operatorRole).toBe("user")
    expect(log!.severity).toBe("warning") // change_pwd → inferSeverity → warning
  })
})

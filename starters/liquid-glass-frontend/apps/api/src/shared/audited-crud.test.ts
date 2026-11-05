/**
 * audited-crud 声明式审计 CRUD 测试
 * 运行方式：bun test src/shared/audited-crud.test.ts
 */
import { beforeAll, describe, expect, it } from "bun:test"

import { getDrizzle } from "../db.js"
import { auditLogs } from "../db/schema.js"
import { setupTestDb } from "../test-helpers.js"
import {
  auditedDelete,
  auditedInsert,
  auditedUpdate,
  type TableAuditConfig,
} from "./audited-crud.js"
import type { OpCtx } from "./op-context.js"

beforeAll(() => {
  setupTestDb()
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const testConfig: TableAuditConfig = {
  module: "user",
  fieldLabels: { name: "姓名", role: "角色", email: "邮箱" },
  snapshotColumns: ["name", "role", "email"],
}

const testCtx: OpCtx = {
  operatorId: "u-admin",
  operator: "管理员",
  operatorAccount: "admin",
  operatorRole: "admin",
  ipAddress: "127.0.0.1",
  userAgent: "test",
  requestId: "",
}

function findLog(requestId: string) {
  return getDrizzle()
    .select()
    .from(auditLogs)
    .all()
    .find((l) => l.requestId === requestId)
}

function countLogs() {
  return getDrizzle().select().from(auditLogs).all().length
}

// ─── auditedUpdate ────────────────────────────────────────────────────────────

describe("auditedUpdate", () => {
  it("有变更时写入审计日志（含 changes diff）", () => {
    auditedUpdate({
      before: { name: "旧名字", role: "user", email: "a@example.com" },
      data: { name: "新名字", role: "user" },
      ctx: { ...testCtx, requestId: "req-upd-1" },
      config: testConfig,
      meta: { target: "用户A", targetId: "u-1" },
    })

    const log = findLog("req-upd-1")

    expect(log).toBeDefined()
    expect(log!.eventType).toBe("update")
    expect(log!.target).toBe("用户A")
    expect(log!.operator).toBe("管理员")

    const changes = JSON.parse(log!.changes ?? "")
    expect(changes["姓名"]).toEqual({ before: "旧名字", after: "新名字" })
    // role 未变不应出现
    expect(changes["角色"]).toBeUndefined()
  })

  it("无实际变更时不写日志", () => {
    const countBefore = countLogs()

    auditedUpdate({
      before: { name: "同名", role: "user" },
      data: { name: "同名", role: "user" },
      ctx: { ...testCtx, requestId: "req-upd-noop" },
      config: testConfig,
      meta: { target: "用户B" },
    })

    expect(countLogs()).toBe(countBefore)
  })

  it("排除列（id/updateTime 等）不参与 diff", () => {
    auditedUpdate({
      before: { id: "1", name: "A", updateTime: "2024-01-01" },
      data: { id: "1", name: "A", updateTime: "2025-01-01" },
      ctx: { ...testCtx, requestId: "req-upd-exclude" },
      config: testConfig,
      meta: { target: "用户C" },
    })

    // name 未变 + id/updateTime 被排除 → 无变更 → 不写日志
    expect(findLog("req-upd-exclude")).toBeUndefined()
  })

  it("data 仅含排除列时不写日志", () => {
    const countBefore = countLogs()

    auditedUpdate({
      before: { name: "A" },
      data: { updateTime: "2025-01-01", updaterId: "u2" },
      ctx: { ...testCtx, requestId: "req-upd-only-exclude" },
      config: testConfig,
      meta: { target: "用户D" },
    })

    expect(countLogs()).toBe(countBefore)
  })

  it("meta.module 覆盖 config.module", () => {
    auditedUpdate({
      before: { name: "旧" },
      data: { name: "新" },
      ctx: { ...testCtx, requestId: "req-upd-module" },
      config: testConfig,
      meta: { target: "用户E", module: "system" },
    })

    expect(findLog("req-upd-module")!.module).toBe("system")
  })

  it("jsonColumns 列 parse 后对比 — 语义相等不写日志", () => {
    const countBefore = countLogs()

    auditedUpdate({
      before: { name: "A", tags: '["x","y"]' },
      data: { tags: '["x","y"]' },
      ctx: { ...testCtx, requestId: "req-upd-json-same" },
      config: { ...testConfig, jsonColumns: ["tags"] },
      meta: { target: "用户F" },
    })

    expect(countLogs()).toBe(countBefore)
  })

  it("jsonColumns 列内容变化时记录 diff", () => {
    auditedUpdate({
      before: { tags: '["x"]' },
      data: { tags: '["x","y"]' },
      ctx: { ...testCtx, requestId: "req-upd-json-diff" },
      config: { ...testConfig, jsonColumns: ["tags"] },
      meta: { target: "用户G" },
    })

    const log = findLog("req-upd-json-diff")
    expect(log).toBeDefined()
    const changes = JSON.parse(log!.changes ?? "")
    expect(changes.tags).toBeDefined()
  })
})

// ─── auditedInsert ────────────────────────────────────────────────────────────

describe("auditedInsert", () => {
  it("写入创建日志（含 snapshot，白名单过滤敏感列）", () => {
    auditedInsert({
      row: {
        name: "新用户",
        role: "user",
        email: "n@example.com",
        password: "hidden",
      },
      ctx: { ...testCtx, requestId: "req-ins-1" },
      config: testConfig,
      meta: { target: "新用户", targetId: "u-new" },
    })

    const log = findLog("req-ins-1")

    expect(log).toBeDefined()
    expect(log!.eventType).toBe("create")
    expect(log!.detail).toContain("新增")

    const changes = JSON.parse(log!.changes ?? "")
    // snapshot 白名单过滤：password 不在 snapshotColumns 中
    expect(changes.snapshot.after).toEqual({
      name: "新用户",
      role: "user",
      email: "n@example.com",
    })
    expect(changes.snapshot.after.password).toBeUndefined()
    expect(changes.snapshot.before).toBeNull()
  })
})

// ─── auditedDelete ────────────────────────────────────────────────────────────

describe("auditedDelete", () => {
  it("写入删除日志（severity=warning，含 before snapshot）", () => {
    auditedDelete({
      before: { name: "被删用户", role: "user", email: "d@example.com" },
      ctx: { ...testCtx, requestId: "req-del-1" },
      config: testConfig,
      meta: { target: "被删用户", targetId: "u-del" },
    })

    const log = findLog("req-del-1")

    expect(log).toBeDefined()
    expect(log!.eventType).toBe("delete")
    expect(log!.severity).toBe("warning")
    expect(log!.detail).toContain("删除")

    const changes = JSON.parse(log!.changes ?? "")
    expect(changes.snapshot.before).toEqual({
      name: "被删用户",
      role: "user",
      email: "d@example.com",
    })
    expect(changes.snapshot.after).toBeNull()
  })
})

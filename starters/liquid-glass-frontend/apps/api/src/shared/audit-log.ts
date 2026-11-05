/**
 * 审计日志基础设施
 * 跨模块审计工具（回流自 CRM 实战沉淀）
 *
 * 提供：
 * - writeLog：写入审计日志（供 service 层 / 特殊场景手动调用）
 * - createLogContext：从 Hono Context 提取审计上下文（operator/ip/ua/requestId）
 * - extractIP：从 Hono Context 提取客户端 IP
 * - inferSeverity：根据 eventType 推导默认 severity
 * - createAuditor：模块级审计函数工厂
 */
import { randomUUID } from "crypto"
import type { Context } from "hono"
import { getConnInfo } from "hono/bun"
import { AUDIT_RESULT } from "shared"

import { getDrizzle } from "../db.js"
import { auditLogs } from "../db/schema.js"
import { getJwtUser } from "../middleware/permission.js"
import { reqLog } from "./logger.js"

/** 从 Hono Context 提取客户端 IP 地址
 * 优先级：x-forwarded-for > x-real-ip > getConnInfo
 */
export function extractIP(c: Context): string {
  const xff = c.req.header("x-forwarded-for")
  if (xff) {
    // 取最右端非空条目：受信代理追加模式下最右 = 最近一跳（单层代理即真实客户端），
    // 最左端由客户端自行声明可伪造，不用于限流等安全用途
    const hops = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (hops.length > 0) return normalizeIP(hops[hops.length - 1])
  }
  const realIp = c.req.header("x-real-ip")
  if (realIp) return normalizeIP(realIp)
  try {
    const info = getConnInfo(c)
    return normalizeIP(info?.remote?.address || "")
  } catch {
    return ""
  }
}

/** 将 IPv6 loopback / IPv4-mapped IPv6 转为友好显示 */
export function normalizeIP(ip: string): string {
  if (ip === "::1" || ip === "::ffff:127.0.0.1") return "127.0.0.1"
  // IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1) → 提取 IPv4 部分
  if (ip.startsWith("::ffff:")) return ip.slice(7)
  return ip
}

/** 从 Hono Context 提取日志上下文（operator / operatorAccount / operatorRole / ipAddress / userAgent / requestId）
 * operatorRole 直取 JWT `role`，零 DB 查询
 */
export function createLogContext(c: Context) {
  const user = getJwtUser(c)
  return {
    operator: user?.username ?? "",
    operatorId: user?.sub ?? "",
    operatorAccount: user?.username ?? "",
    operatorRole: user?.role ?? "",
    ipAddress: extractIP(c),
    userAgent: c.req.header("user-agent") || "",
    requestId: c.get("requestId") ?? "",
  }
}

// ─── severity 自动推导 ────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, string> = {
  delete: "warning",
  permission_change: "warning",
  login: "info", // 登录失败由调用方显式传 warning
  change_pwd: "warning",
  reset_pwd: "warning",
}

/** 根据 eventType 推导默认 severity，调用方可覆盖 */
export function inferSeverity(eventType: string): string {
  return SEVERITY_MAP[eventType] ?? "info"
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return "[序列化失败]"
  }
}

/**
 * 辅助函数：在其他模块中直接调用写入审计日志（无需 HTTP 请求）
 */
export function writeLog(params: {
  operator: string
  operatorId?: string
  operatorAccount?: string
  operatorRole: string
  module: string
  eventType: string
  target: string
  targetId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
  result?: string
  severity?: string
  detail?: string
  changes?: Record<string, { before: unknown; after: unknown }>
}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  try {
    getDrizzle()
      .insert(auditLogs)
      .values({
        id,
        operator: params.operator,
        operatorId: params.operatorId ?? "",
        operatorAccount: params.operatorAccount ?? "",
        operatorRole: params.operatorRole,
        eventType: params.eventType,
        module: params.module,
        target: params.target,
        targetId: params.targetId ?? "",
        ipAddress: params.ipAddress ?? "",
        userAgent: params.userAgent ?? "",
        requestId: params.requestId ?? "",
        result: params.result ?? AUDIT_RESULT.SUCCESS,
        severity: params.severity ?? inferSeverity(params.eventType),
        detail: params.detail ?? "",
        changes: params.changes ? safeStringify(params.changes) : "",
        createTime: now,
      })
      .run()
  } catch (err) {
    reqLog().error(
      {
        err,
        module: params.module,
        operator: params.operator,
        target: params.target,
        eventType: params.eventType,
      },
      "audit.write.failed"
    )
  }
}

// ─── createAuditor 工厂 ────────────────────────────────────────────────────────

/** Auditor 函数签名 */
export type Auditor = (
  ctx: {
    operator: string
    operatorId: string
    operatorAccount: string
    operatorRole: string
    ipAddress: string
    userAgent: string
    requestId: string
  },
  params: {
    eventType: string
    target: string
    targetId?: string
    detail?: string
    severity?: string
    result?: string
    changes?: Record<string, { before: unknown; after: unknown }>
  }
) => void

/**
 * 创建模块级审计函数（消除 OpCtx → writeLog 6 字段映射样板）
 *
 * 用于非 CRUD 业务动作：
 * ```ts
 * const audit = createAuditor(AUDIT_MODULES.USER)
 * audit(ctx, { eventType: "change_pwd", target: user.email, targetId: id })
 * ```
 */
export function createAuditor(module: string): Auditor {
  return (ctx, params) => {
    writeLog({
      operator: ctx.operator,
      operatorId: ctx.operatorId,
      operatorAccount: ctx.operatorAccount,
      operatorRole: ctx.operatorRole,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      module,
      eventType: params.eventType,
      target: params.target,
      targetId: params.targetId,
      detail: params.detail,
      severity: params.severity,
      result: params.result,
      changes: params.changes,
    })
  }
}

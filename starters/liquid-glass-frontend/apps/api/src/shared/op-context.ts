/**
 * 操作上下文（OpCtx）
 * Service 层统一入参：从 Hono Context 提取的纯数据操作上下文
 *
 * 设计意图：
 * - Service 层不依赖 Hono Context，只接收 OpCtx（纯数据）
 * - opCtxMiddleware 在 authMiddleware 后统一注入，Handler 用 c.get("opCtx") 获取
 * - 声明式审计封装（audited-crud）的审计元数据即由 OpCtx 提供
 *
 * CRM 完整版差异点：完整版会查业务表取 realName/channelId（渠道用户查
 * channels、内部用户查 users），在此扩展；本版全部字段直取 JWT + headers，
 * 零 DB 查询。
 */
import type { Context, Next } from "hono"

import type { JwtPayload } from "../middleware/auth.js"
import { getJwtUser } from "../middleware/permission.js"
import { extractIP } from "./audit-log.js"

/** 操作上下文：Service 层入参统一形态 */
export interface OpCtx {
  /** 操作人用户 ID（JWT sub） */
  operatorId: string
  /** 操作人显示名（直取 JWT username；接入业务表后可换 realName） */
  operator: string
  /** 操作人账号（username） */
  operatorAccount: string
  /** 操作人角色编码（JWT role） */
  operatorRole: string
  /** 客户端 IP */
  ipAddress: string
  /** User-Agent */
  userAgent: string
  /** 请求关联 ID（用于审计追踪） */
  requestId: string
  /** 会话 ID（JWT jti）：登出/审计定位用；旧 token 可能为空 */
  sid?: string
}

// ─── Hono Context 变量类型扩展（user / opCtx 全局可用）───────────────────────
// requestId / logger 已由 shared/logger.ts 声明，此处仅补充本模块引入的变量
declare module "hono" {
  interface ContextVariableMap {
    user?: JwtPayload
    opCtx?: OpCtx
  }
}

/** 从 Hono Context 提取 OpCtx（Handler 调 Service 前转换），零 DB 查询 */
export function toOpCtx(c: Context): OpCtx {
  const user = getJwtUser(c)

  return {
    operatorId: user?.sub ?? "",
    operator: user?.username ?? "",
    operatorAccount: user?.username ?? "",
    operatorRole: user?.role ?? "",
    ipAddress: extractIP(c),
    userAgent: c.req.header("user-agent") || "",
    requestId: c.get("requestId") ?? "",
    sid: user?.sid,
  }
}

/**
 * opCtx 注入中间件：注册在 authMiddleware 之后，统一挂载操作上下文
 * handler 用 `c.get("opCtx")` 获取，无需每次手写 toOpCtx(c)
 */
export async function opCtxMiddleware(c: Context, next: Next) {
  c.set("opCtx", toOpCtx(c))
  await next()
}

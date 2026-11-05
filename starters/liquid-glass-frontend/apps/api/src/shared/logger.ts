/**
 * 结构化日志基础设施
 * Pino 同步模式输出 JSON 到 stdout（Bun 二进制安全）
 *
 * 提供：
 * - logger：全局 Pino 实例（启动/引导阶段使用）
 * - reqLog()：获取当前请求级 logger（自动带 requestId，基于 AsyncLocalStorage）
 * - runWithLogger()：中间件调用，绑定请求生命周期内的 child logger
 */
import { AsyncLocalStorage } from "node:async_hooks"

import pino, { type Logger } from "pino"

import { env } from "../env.js"

// ─── Hono Context 变量类型扩展（requestId / logger 全局可用）──────────────────
declare module "hono" {
  interface ContextVariableMap {
    requestId: string
    logger: Logger
  }
}

/** 服务名：优先环境变量，兜底 package name */
const serviceName = process.env.SERVICE_NAME || "api"

/** 全局 logger 实例（同步模式，JSON -> stdout） */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: serviceName, env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
})

// ─── AsyncLocalStorage：请求级 logger 自动贯穿 ───────────────────────────────

const als = new AsyncLocalStorage<Logger>()

/**
 * 在整个请求生命周期内绑定 child logger。
 * 必须用于包裹 Hono 中间件的 next()，保证后续所有 handler/service
 * 调用 reqLog() 时能获取到同一个请求级 logger。
 * 不要用于包裹局部代码片段。
 */
export function runWithLogger<T>(log: Logger, fn: () => T): T {
  return als.run(log, fn)
}

/** 任意位置调用：获取当前请求 logger（自动带 requestId），无上下文时回退全局 */
export function reqLog(): Logger {
  return als.getStore() ?? logger
}

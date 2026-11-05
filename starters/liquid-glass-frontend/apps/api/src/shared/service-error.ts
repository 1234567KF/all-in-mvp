/**
 * Service 层错误 → HTTP 响应映射
 * handler 捕获 service 抛出的领域错误后，统一转换为 fail() 响应
 *
 * 设计：领域错误统一继承 ServiceError 并自带 HTTP status + 错误码，
 * mapServiceError 只读 err.status / err.code，新增错误类型无需修改本文件（开闭原则）。
 */
import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import { fail } from "../response.js"
import { reqLog } from "./logger.js"

/**
 * 领域错误基类：携带 HTTP status 与错误码。
 * 各模块错误类继承并在构造时传入对应状态码：
 * ```ts
 * export class FooNotFoundError extends NotFoundError {
 *   constructor(message = "Foo 不存在") {
 *     super(message)
 *     this.name = "FooNotFoundError"
 *   }
 * }
 * ```
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: ContentfulStatusCode,
    readonly code?: string
  ) {
    super(message)
    this.name = "ServiceError"
  }
}

/** 404 — 资源不存在 */
export class NotFoundError extends ServiceError {
  constructor(message = "资源不存在") {
    super(message, 404, "NOT_FOUND")
    this.name = "NotFoundError"
  }
}

/** 409 — 唯一性/状态冲突 */
export class ConflictError extends ServiceError {
  constructor(message = "资源冲突") {
    super(message, 409, "CONFLICT")
    this.name = "ConflictError"
  }
}

/** 403 — 无权限操作 */
export class ForbiddenError extends ServiceError {
  constructor(message = "无权限操作") {
    super(message, 403, "FORBIDDEN")
    this.name = "ForbiddenError"
  }
}

/** 400 — 业务校验失败 */
export class ValidationError extends ServiceError {
  constructor(message = "参数校验失败") {
    super(message, 400, "VALIDATION")
    this.name = "ValidationError"
  }
}

/**
 * 将 service 抛出的错误映射为 HTTP 响应。
 * @param c Hono context
 * @param err service 抛出的错误
 * @param conflictMapper 可选：针对名称冲突类错误，按场景定制提示文案（返回 message）
 */
export function mapServiceError(
  c: Context,
  err: unknown,
  conflictMapper?: (err: unknown) => string | null
): Response {
  // 名称冲突类错误：优先用调用方提供的文案定制
  if (conflictMapper) {
    const msg = conflictMapper(err)
    if (msg) return fail(c, 409, "CONFLICT", msg)
  }

  if (err instanceof ServiceError) {
    return fail(c, err.status, err.code, err.message)
  }

  reqLog().error(
    {
      err,
      errName: (err as { name?: string })?.name,
      method: c.req.method,
      path: c.req.path,
    },
    "service.error.unexpected"
  )
  return fail(c, 500, "INTERNAL_ERROR", "服务器内部错误")
}

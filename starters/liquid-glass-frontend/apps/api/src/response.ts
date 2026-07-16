import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { ApiResponse as BaseApiResponse } from "shared"

/** 带 code 的响应类型（扩展 shared 基础类型） */
type ApiResponse<T = unknown> = BaseApiResponse<T> & { code?: string }

/** 成功响应 */
export function ok<T>(
  c: Context,
  data?: T,
  message = "OK",
  status: ContentfulStatusCode = 200,
  code?: string
) {
  return c.json(
    {
      success: true,
      ...(code && { code }),
      message,
      data,
    } satisfies ApiResponse<T>,
    status
  )
}

const DEFAULT_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  500: "INTERNAL_ERROR",
  503: "SERVICE_UNAVAILABLE",
}

/** 失败响应 */
export function fail(
  c: Context,
  status: ContentfulStatusCode,
  code = DEFAULT_CODE[status] ?? "ERROR",
  message = "",
  errors?: Record<string, unknown>
) {
  return c.json(
    {
      success: false,
      code,
      ...(message && { message }),
      ...(errors && { errors }),
    } satisfies ApiResponse,
    status
  )
}

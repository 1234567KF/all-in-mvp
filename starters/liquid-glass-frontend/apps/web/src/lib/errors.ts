/**
 * 从 API 错误响应中提取字段级错误映射。
 * 返回 response.data.errors（Record<string, string>），不存在时返回 undefined。
 */
export function extractFieldErrors(
  err: unknown
): Record<string, string> | undefined {
  if (err && typeof err === "object") {
    const errors = (err as { response?: { data?: { errors?: unknown } } })
      .response?.data?.errors
    if (
      errors &&
      typeof errors === "object" &&
      !Array.isArray(errors) &&
      Object.values(errors as Record<string, unknown>).every(
        (v) => typeof v === "string"
      )
    ) {
      return errors as Record<string, string>
    }
  }
  return undefined
}

/**
 * 从未知错误中提取可展示的错误信息。
 * 优先 response.data.message（服务端消息）；其次 Error.message；兜底默认文案。
 */
export function extractErrorMessage(err: unknown): string {
  // 优先提取 axios 响应体中的服务端错误消息
  if (err && typeof err === "object") {
    const message = (err as { response?: { data?: { message?: unknown } } })
      .response?.data?.message
    if (typeof message === "string" && message) return message
  }

  if (err instanceof Error && err.message) return err.message

  return "操作失败，请重试"
}

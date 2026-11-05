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

/** 无 response（断网 / 超时 / CORS）时 axios 抛出的英文原生 message */
const NETWORK_ERROR_RE =
  /^(network error|timeout of \d+ms exceeded|failed to fetch|load failed)$/i

/** 收到 HTTP 错误但响应体没有 message 时 axios 生成的英文 message */
const HTTP_STATUS_ERROR_RE = /^request failed with status code \d{3}$/i

const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试"
const GENERIC_ERROR_MESSAGE = "操作失败，请重试"

/**
 * 从未知错误中提取可展示的错误信息。
 * 优先 response.data.message（服务端消息）；其次 Error.message；兜底默认文案。
 *
 * 例外：axios 在「请求未到达服务端」或「响应体没带 message」时给出的英文原生
 * message（Network Error / timeout of 10000ms exceeded / Request failed with
 * status code 500）不适合直接展示给用户，这里统一转成中文兜底。
 */
export function extractErrorMessage(err: unknown): string {
  // 优先提取 axios 响应体中的服务端错误消息
  if (err && typeof err === "object") {
    const message = (err as { response?: { data?: { message?: unknown } } })
      .response?.data?.message
    if (typeof message === "string" && message) return message
  }

  if (err instanceof Error && err.message) {
    if (NETWORK_ERROR_RE.test(err.message)) return NETWORK_ERROR_MESSAGE
    if (HTTP_STATUS_ERROR_RE.test(err.message)) return GENERIC_ERROR_MESSAGE
    return err.message
  }

  return GENERIC_ERROR_MESSAGE
}

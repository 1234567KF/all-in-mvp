/**
 * Error Utilities
 * 统一错误信息提取工具
 */

/**
 * 从未知错误中提取可读的错误信息
 * - Error 实例返回 err.message
 * - 其他带 message 字段的对象返回该字段
 * - 兜底返回 "操作失败"
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  const message = (err as { message?: unknown } | null | undefined)?.message
  if (typeof message === "string" && message) return message
  return "操作失败"
}

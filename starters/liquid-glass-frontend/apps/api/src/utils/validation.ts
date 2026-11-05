/**
 * Zod 校验工具
 * 将 ZodError 转为字段级错误 Map，兼容 fail() 响应结构
 */
import type { ZodSafeParseResult } from "zod"

/** 内部统一类型：接受任意 safeParse 返回值 */
type AnyParseResult = ZodSafeParseResult<unknown>

/**
 * 从 safeParse 失败结果中提取字段级错误
 * @returns { field: firstMessage } — 仅保留每个字段的首条错误信息
 */
export function formatZodErrors(
  result: AnyParseResult
): Record<string, string> {
  if (result.success) return {}
  const flat = result.error.flatten()
  const mapped: Record<string, string> = {}
  const fieldErrors = flat.fieldErrors as Record<string, string[] | undefined>
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      mapped[field] = messages[0]
    }
  }
  // formErrors（顶层 refine）也归入 _form 键
  if (flat.formErrors.length > 0) {
    mapped._form = flat.formErrors[0]
  }
  return mapped
}

/**
 * 获取 safeParse 失败结果的首条错误信息（用于 fail(c, 400, msg)）
 */
export function firstZodError(result: AnyParseResult): string {
  if (result.success) return ""
  return result.error.issues[0]?.message ?? "参数校验失败"
}

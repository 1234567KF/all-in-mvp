import { useState } from "react"
import { z, type ZodType } from "zod"

/**
 * 通用表单校验 hook（基于 zod v4）
 * validate 成功时清空错误并返回 true；失败时按字段映射首条错误信息并返回 false
 */
export function useFormValidation<T>(schema: ZodType<T>) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})

  const validate = (data: unknown): data is T => {
    const result = z.safeParse(schema, data)
    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors
      const mapped: Partial<Record<keyof T, string>> = {}
      for (const k in fieldErrors) {
        const arr = (fieldErrors as Record<string, string[] | undefined>)[k]
        if (arr?.[0]) (mapped as Record<string, string>)[k] = arr[0]
      }
      setErrors(mapped)
      return false
    }
    setErrors({})
    return true
  }

  /**
   * 将服务端返回的字段级错误合并到当前 error state 中。
   * 服务端 key 需与表单字段名对齐，直接覆盖对应字段的错误信息。
   */
  const mergeServerErrors = (serverErrors: Record<string, string>) => {
    setErrors((prev) => ({
      ...prev,
      ...(serverErrors as Partial<Record<keyof T, string>>),
    }))
  }

  return { errors, setErrors, validate, mergeServerErrors }
}

/**
 * 服务端字段级错误回填工具
 *
 * 只支持**扁平**字段错误形状（route 层的 formatZodErrors 与全局 400
 * VALIDATION_ERROR 统一产出 `{ field: "message", _form: "message" }`）；
 * 若服务端某个入口仍返回嵌套的 Zod `format()` 载荷，应先在服务端转平，
 * 不要把两种形状混进前端。
 *
 * 后端校验失败（HTTP 400）响应形如：
 *   { message: "参数校验失败", errors: { name: "名称不能为空" } }
 * 前端拿到后可一键挂载到 react-hook-form 的字段错误上，免去在每个表单里
 * 手写「提取 errors → 逐个 setError」的重复代码。
 */
import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

import { extractFieldErrors } from "@/lib/errors"

/** 约定挂到整个表单（而非具体字段）的错误 key：_form 或 root */
const ROOT_ERROR_KEYS = new Set(["_form", "root"])

/**
 * 把服务端响应中的字段级错误一键回填到 react-hook-form。
 *
 * - 从 `extractFieldErrors(err)` 取 `response.data.errors`（Record<string, string>）；
 *   没有字段级错误时返回 false，调用方可继续走通用错误提示。
 * - `_form` / `root` 两个约定 key 挂到表单根（`setError("root", ...)`），
 *   用于「表单级错误」（如两次密码不一致、整体校验失败），其余按字段名回填。
 * - 空字符串 / 纯空白消息没有展示价值，直接跳过。
 *
 * @returns 是否至少有一个错误被真正挂载（供调用方决定要不要额外 toast）
 */
export function applyServerFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>
): boolean {
  const fieldErrors = extractFieldErrors(err)
  if (!fieldErrors) return false

  let applied = false
  for (const [field, message] of Object.entries(fieldErrors)) {
    const msg = message.trim()
    if (!msg) continue

    if (ROOT_ERROR_KEYS.has(field)) {
      // react-hook-form v7 的 UseFormSetError 第一个参数类型为
      // FieldPath<T> | ErrorNamespacePath，ErrorNamespacePath 已包含 "root"，无需断言
      setError("root", { type: "server", message: msg })
    } else {
      // 服务端字段名来自运行时 errors 对象，编译期无法收窄为 Path<T>；
      // 这里由调用方保证表单字段名与后端 schema 一致
      setError(field as Path<T>, { type: "server", message: msg })
    }
    applied = true
  }

  return applied
}

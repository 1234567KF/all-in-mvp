import type { Context } from "hono"

/**
 * 安全解析 JSON 请求体，畸形 body 返回 undefined 而非抛异常。
 *
 * 默认泛型为 `Record<string, any>`：
 * - 较 `Record<string, unknown>` 更宽松，避免 TS 6.0 中 `unknown` narrow 到 `{}` 引发的一大片属性访问报错；
 * - body 仅用于后续 `zod` 校验（校验后的 `parsed.data` 才是强类型数据源），
 *   未经校验的原始 body 保持 `any` 更符合实际语义（不受信任、结构未知）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeJson<T = Record<string, any>>(
  c: Context
): Promise<T | undefined> {
  try {
    return (await c.req.json()) as T
  } catch {
    return undefined
  }
}

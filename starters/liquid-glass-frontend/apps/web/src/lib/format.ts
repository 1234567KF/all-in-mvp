/** 金额格式化：>= 10000 显示为 X.X万，否则本地化数字 */
export function formatAmount(amount: number): string {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`
  return amount.toLocaleString()
}

/** 全站统一空值占位符（破折号 —） */
export const EMPTY_VALUE = "—"

/**
 * 统一空值处理函数
 * 若原始值为空（null、undefined、"" 或纯空格），返回统一占位符 "—"
 */
export function formatEmpty(
  val: unknown,
  fallback: string = EMPTY_VALUE
): string {
  if (val === null || val === undefined) return fallback
  if (typeof val === "string" && !val.trim()) return fallback
  return String(val)
}

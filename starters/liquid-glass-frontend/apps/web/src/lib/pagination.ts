/**
 * 分页页码生成工具
 */

/**
 * 生成页码列表（含省略号）
 * - total <= 7：全显示
 * - total > 7：显示首尾 + 当前页前后1页 + 省略号
 */
export function getPageNumbers(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (current > 3) pages.push("ellipsis")
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push("ellipsis")
  pages.push(total)
  return pages
}

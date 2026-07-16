/**
 * 日期/时间格式化工具集
 */

/**
 * 相对时间格式化：
 * - < 1 分钟 → "刚刚" / "just now"
 * - < 60 分钟 → "N 分钟前"
 * - < 24 小时 → "N 小时前"
 * - < 7 天 → "N 天前"
 * - >= 7 天 → "M/D"
 */
export function formatRelativeTime(iso: string, locale = "zh-CN"): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) {
    return locale.startsWith("zh") ? "刚刚" : "just now"
  }

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" })
    if (minutes < 60) return rtf.format(-minutes, "minute")
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return rtf.format(-hours, "hour")
    const days = Math.floor(hours / 24)
    if (days < 7) return rtf.format(-days, "day")
  } catch {
    // Fallback if Intl.RelativeTimeFormat is not supported
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} 天前`
  }

  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 日期时间格式化，支持 ISO 字符串 / Unix 毫秒时间戳 / null。
 * 统一输出 "YYYY-MM-DD HH:mm:ss"（本地时区，24 小时制）。
 */
export function formatTimestamp(
  iso: string | number | null,
  locale = "zh-CN"
): string {
  if (iso === null || iso === undefined) return "-"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)

  try {
    return d.toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }
}

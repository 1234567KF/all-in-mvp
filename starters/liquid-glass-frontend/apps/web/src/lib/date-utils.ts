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

/**
 * 日期格式化，支持 ISO 字符串 / Unix 毫秒时间戳 / Date / null。
 * 统一输出 "YYYY-MM-DD"（本地时区）。
 *
 * 这是 no-toisostring-slice 规则给出的正解入口：需要"今天的日期串"时用
 * formatDate(new Date())，不要写 new Date().toISOString().slice(0, 10) —
 * 后者取的是 UTC 日期，在 UTC+ 时区会把日期往前挪一天。
 */
export function formatDate(
  iso: string | number | Date | null | undefined
): string {
  if (iso === null || iso === undefined) return "-"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * 取本地某一天的边界时刻（完整 ISO 串），用于日期范围查询参数。
 *
 * 直接对 toISOString() 截断得到的是 UTC 日的起止，跨时区会漏掉或多吃一天；
 * 正确做法是先按本地时间构造当天 00:00:00.000 / 23:59:59.999，再转 ISO。
 */
export function getLocalDayBoundaryISO(
  date: Date,
  boundary: "start" | "end"
): string {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  return boundary === "start"
    ? new Date(y, m, d, 0, 0, 0, 0).toISOString()
    : new Date(y, m, d, 23, 59, 59, 999).toISOString()
}

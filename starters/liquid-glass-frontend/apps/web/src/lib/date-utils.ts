/**
 * 日期/时间格式化工具集
 */

/**
 * 相对时间格式化：
 * - 非法时间（无法解析为有效 Date）→ "-"
 * - < 1 分钟 → "刚刚" / "just now"
 * - < 60 分钟 → "N 分钟前"
 * - < 24 小时 → "N 小时前"
 * - < 7 天 → "N 天前"
 * - >= 7 天 → "M/D"
 */
export function formatRelativeTime(iso: string, locale = "zh-CN"): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "-"

  const diff = Date.now() - parsed.getTime()
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

  return `${parsed.getMonth() + 1}/${parsed.getDate()}`
}

/**
 * 日期时间格式化，支持 ISO 字符串 / Unix 毫秒时间戳 / Date / null。
 * 统一输出 "YYYY-MM-DD HH:mm:ss"（本地时区，24 小时制）。
 */
export function formatTimestamp(
  iso: string | number | Date | null,
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
 * 格式化日期为 YYYY-MM-DD 格式
 */
export function formatDate(iso: string | number | Date | null): string {
  if (iso === null || iso === undefined) return "-"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const r = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${r}`
}

/**
 * 解析 "YYYY-MM-DD" / "YYYY/MM/DD" 日期字符串为 Date（无效输入返回 undefined）。
 * 统一换为 "/" 分隔避免 Safari 对 "-" 分隔本地日期的解析差异。
 */
export function parseDateString(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  const normalized = dateStr.includes("-")
    ? dateStr.replace(/-/g, "/")
    : dateStr
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? undefined : d
}

/**
 * 将给定 Date 折算到“当日本地日界”对应的 UTC ISO 字符串，供后端按完整 ISO 时间戳比较时使用。
 *
 * - boundary="start" → 本地 00:00:00.000 → UTC ISO
 * - boundary="end"   → 本地 23:59:59.999 → UTC ISO
 *
 * 只取输入 Date 的 year/month/date，忽略其时/分/秒，适合从日历控件返回的 Date。
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

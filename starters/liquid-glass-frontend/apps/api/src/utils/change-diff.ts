/**
 * Change Diff Utilities
 * 对比编辑前后的对象，生成结构化变更 diff
 */

/**
 * 对比编辑前后的对象，生成变更 diff
 * @param before 编辑前的完整对象
 * @param after 编辑后的部分对象（只含被修改的字段）
 * @param fieldLabels 可选的字段名→中文标签映射
 * @returns 变更记录，key 为字段名（或中文标签），value 为 { before, after }
 */
export function buildChanges<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fieldLabels?: Record<string, string>
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {}

  for (const key of Object.keys(after)) {
    const afterValue = after[key]

    // 跳过 undefined（表示未修改）
    if (afterValue === undefined) continue

    // 对象/数组序列化后比较，避免引用不等导致误报
    const beforeNorm = normalizeValue(before[key])
    const afterNorm = normalizeValue(afterValue)
    if (afterNorm !== beforeNorm) {
      const label = fieldLabels?.[key] ?? key
      changes[label] = {
        before: beforeNorm,
        after: afterNorm,
      }
    }
  }

  return changes
}

/** 对象/数组序列化为 JSON 字符串，避免 toString() 变成 [object Object] */
function normalizeValue(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value, null, 2)
  }
  return value
}

/**
 * 从结构化变更派生可读的 detail 文本
 * 保证「审计详情」与「变更明细」同源，不会漂移
 */
export function buildDetail(
  changes: Record<string, { before: unknown; after: unknown }>
): string {
  return Object.entries(changes)
    .map(
      ([field, v]) =>
        `${field}: ${v.before == null || v.before === "" ? "空" : v.before} → ${v.after == null || v.after === "" ? "空" : v.after}`
    )
    .join("; ")
}

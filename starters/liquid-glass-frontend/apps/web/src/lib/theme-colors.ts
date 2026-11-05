/**
 * Theme Colors — 主题色（主色系）预设。
 *
 * 颜色值不在这里：全部定义在 `theme-tokens.css` 的 `--theme-*` 种子与
 * `:root[data-theme-color="<id>"]` 预设块中。本文件只维护选项元数据、
 * 默认值、localStorage key，以及运行时校验。
 */

export const THEME_COLORS = [
  { id: "green", label: "翡翠绿" },
  { id: "blue", label: "科技蓝" },
  { id: "purple", label: "星云紫" },
  { id: "cyan", label: "极光青" },
  { id: "orange", label: "落日橙" },
  { id: "rose", label: "玫瑰粉" },
] as const

export type ThemeColorId = (typeof THEME_COLORS)[number]["id"]

/** 仅作为运行时遍历入口；id 的唯一事实源是 THEME_COLORS */
export const THEME_COLOR_IDS: readonly ThemeColorId[] = THEME_COLORS.map(
  (color) => color.id
)

export interface ThemeColorOption {
  id: ThemeColorId
  label: string
}

export const DEFAULT_THEME_COLOR: ThemeColorId = "green"

/** 与 theme-provider.tsx / index.html 首屏脚本保持一致 */
export const THEME_COLOR_STORAGE_KEY = "theme-color"

export function isThemeColor(value: unknown): value is ThemeColorId {
  if (typeof value !== "string") {
    return false
  }

  return THEME_COLORS.some((color) => color.id === value)
}

export function getThemeColorOption(id: ThemeColorId): ThemeColorOption {
  return THEME_COLORS.find((color) => color.id === id) ?? THEME_COLORS[0]
}

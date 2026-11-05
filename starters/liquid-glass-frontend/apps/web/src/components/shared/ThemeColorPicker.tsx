import { Check } from "lucide-react"

import { useTheme } from "@/components/providers/theme-provider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { isThemeColor, THEME_COLORS } from "@/lib/theme-colors"
import { cn } from "@/lib/utils"

interface ThemeColorPickerProps {
  /** 显示色点下方的中文名（设置页完整面板） */
  showLabels?: boolean
  className?: string
}

/**
 * 主题色选择器：色块背景全部来自 theme-tokens.css 的 --theme-swatch-*，
 * 不在组件内硬编码任何颜色值。
 */
export function ThemeColorPicker({
  showLabels = false,
  className,
}: ThemeColorPickerProps) {
  const { themeColor, setThemeColor } = useTheme()

  return (
    <ToggleGroup
      type="single"
      aria-label="主题色"
      value={themeColor}
      onValueChange={(value) => {
        // Radix single 模式允许反选（value 为 ""），此处保持当前主题色
        if (isThemeColor(value)) {
          setThemeColor(value)
        }
      }}
      className={cn(
        "w-full",
        showLabels
          ? "grid grid-cols-3 gap-2 sm:grid-cols-6"
          : "grid grid-cols-6 gap-2",
        className
      )}
    >
      {THEME_COLORS.map((color) => {
        const isActive = themeColor === color.id
        const swatchColor = `var(--theme-swatch-${color.id})`

        if (showLabels) {
          return (
            <ToggleGroupItem
              key={color.id}
              value={color.id}
              aria-label={color.label}
              title={color.label}
              className={cn(
                "flex h-auto min-h-0 min-w-0 flex-col gap-1.5 rounded-lg border border-[var(--lg-border)] bg-transparent px-1.5 py-2.5",
                "data-[state=on]:border-[var(--lg-primary)] data-[state=on]:bg-[var(--lg-primary-dim)]"
              )}
            >
              <span
                className="flex size-6 items-center justify-center rounded-full border border-[var(--lg-border)]"
                style={{ background: swatchColor }}
              >
                {isActive && (
                  <Check
                    className="size-3.5"
                    style={{ color: "var(--theme-swatch-check)" }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="text-center text-[11px] leading-none font-medium text-[var(--lg-text-secondary)]">
                {color.label}
              </span>
            </ToggleGroupItem>
          )
        }

        return (
          <ToggleGroupItem
            key={color.id}
            value={color.id}
            aria-label={color.label}
            title={color.label}
            className={cn(
              "touch-hit size-9 rounded-full border border-[var(--lg-border)] p-0 transition-all",
              "focus-visible:ring-2 focus-visible:ring-[var(--lg-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lg-background)]",
              "data-[state=on]:shadow-[0_0_0_2px_var(--lg-background),0_0_0_3px_var(--lg-primary)]"
            )}
            style={{ background: swatchColor }}
          >
            {isActive && (
              <Check
                className="size-4"
                style={{ color: "var(--theme-swatch-check)" }}
                aria-hidden="true"
              />
            )}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

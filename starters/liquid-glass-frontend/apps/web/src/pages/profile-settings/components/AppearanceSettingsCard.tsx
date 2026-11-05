import { Moon, Palette, Sun, SunMoon } from "lucide-react"

import { useTheme } from "@/components/providers/theme-provider"
import { ThemeColorPicker } from "@/components/shared/ThemeColorPicker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getThemeColorOption } from "@/lib/theme-colors"
import { cn } from "@/lib/utils"
import { type LayoutWidth, useLayoutStore } from "@/stores/layoutStore"

export function AppearanceSettingsCard() {
  const { theme, setTheme, themeColor } = useTheme()
  const { layoutWidth, setLayoutWidth } = useLayoutStore()

  return (
    <Card className="glass-card py-0">
      <CardHeader className="px-6 pt-6 pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-5 text-[var(--lg-primary-light)]" />
          外观主题
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-6">
        <div>
          <div className="mb-2 block text-sm font-medium text-foreground">
            选择主题
          </div>
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(value) => {
              if (value) setTheme(value as "dark" | "light" | "system")
            }}
            className="flex w-full gap-2 sm:gap-3"
          >
            <ToggleGroupItem
              value="dark"
              className={cn(
                "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                theme === "dark"
                  ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                  : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
              )}
            >
              <Moon className="mx-auto mb-1.5 size-6 text-foreground sm:size-8" />
              <div className="text-xs font-semibold text-foreground sm:text-sm">
                深色主题
              </div>
              <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                默认
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="light"
              className={cn(
                "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                theme === "light"
                  ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                  : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
              )}
            >
              <Sun className="mx-auto mb-1.5 size-6 text-foreground sm:size-8" />
              <div className="text-xs font-semibold text-foreground sm:text-sm">
                浅色主题
              </div>
              <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                实验性
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="system"
              className={cn(
                "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                theme === "system"
                  ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                  : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
              )}
            >
              <SunMoon className="mx-auto mb-1.5 size-6 text-foreground sm:size-8" />
              <div className="text-xs font-semibold text-foreground sm:text-sm">
                跟随系统
              </div>
              <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                自动切换
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator className="bg-[var(--lg-border-subtle)]" />

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="block text-sm font-medium text-foreground">
              主题色
            </div>
            <div className="text-xs text-[var(--lg-text-secondary)]">
              当前：{getThemeColorOption(themeColor).label}
            </div>
          </div>
          <ThemeColorPicker showLabels />
          <p className="mt-2 text-xs text-[var(--lg-text-secondary)]">
            主题色同时适配深色 / 浅色模式，并保存在浏览器本地
          </p>
        </div>

        <Separator className="bg-[var(--lg-border-subtle)]" />

        <div>
          <div className="mb-2 block text-sm font-medium text-foreground">
            页面布局宽度
          </div>
          <ToggleGroup
            type="single"
            value={layoutWidth}
            onValueChange={(value) => {
              if (value) setLayoutWidth(value as LayoutWidth)
            }}
            className="flex w-full gap-2 sm:gap-3"
          >
            <ToggleGroupItem
              value="standard"
              className={cn(
                "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                layoutWidth === "standard"
                  ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                  : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
              )}
            >
              <div className="text-xs font-semibold text-foreground sm:text-sm">
                标准
              </div>
              <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                1280px 居中
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="wide"
              className={cn(
                "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                layoutWidth === "wide"
                  ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                  : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
              )}
            >
              <div className="text-xs font-semibold text-foreground sm:text-sm">
                宽屏
              </div>
              <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                1600px (默认)
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="fluid"
              className={cn(
                "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                layoutWidth === "fluid"
                  ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                  : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
              )}
            >
              <div className="text-xs font-semibold text-foreground sm:text-sm">
                撑满
              </div>
              <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                100% 宽度
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator className="bg-[var(--lg-border-subtle)]" />

        <div>
          <div className="mb-1 block text-sm font-medium text-foreground">
            偏好设置
          </div>
          <p className="text-xs text-[var(--lg-text-secondary)]">
            外观与布局偏好将保存在浏览器本地，下次访问时自动应用
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

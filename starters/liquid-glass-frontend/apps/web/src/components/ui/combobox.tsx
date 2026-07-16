import { Check, ChevronDown, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface ComboboxItem {
  value: string
  label: string
  subLabel?: string
}

export interface ComboboxProps {
  /** 选项列表数据 */
  data: ComboboxItem[]
  /** 选中的值 (single时为string，multiple时为string[]) */
  value?: string | string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onValueChange?: (value: any) => void
  /** 单选或多选模式 */
  type?: "single" | "multiple"
  /** 触发器占位文字 */
  placeholder?: string
  /** 搜索输入框占位文字 */
  searchPlaceholder?: string
  /** 空状态提示 */
  emptyText?: string
  /** 前置 Icon */
  icon?: React.ReactNode
  /** 前置前缀（例如：'人员：'） */
  prefix?: string
  /** 是否可清空 */
  clearable?: boolean
  /** 样式变体 */
  variant?: "glass" | "default"
  /** 触发器 className */
  className?: string
  /** 浮层宽度 */
  popoverWidth?: string
}

export function Combobox({
  data,
  value,
  onValueChange,
  type = "single",
  placeholder = "请选择...",
  searchPlaceholder = "搜索...",
  emptyText = "未找到匹配项",
  icon,
  prefix = "",
  clearable = true,
  variant = "glass",
  className,
  popoverWidth = "w-[240px]",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // 格式化当前值
  const selectedValues = React.useMemo(() => {
    if (!value) return new Set<string>()
    if (Array.isArray(value)) return new Set<string>(value)
    return new Set<string>([value])
  }, [value])

  const handleSelect = (itemValue: string) => {
    if (type === "single") {
      const nextValue = selectedValues.has(itemValue) ? "" : itemValue
      onValueChange?.(nextValue)
      setOpen(false)
    } else {
      const next = new Set(selectedValues)
      if (next.has(itemValue)) {
        next.delete(itemValue)
      } else {
        next.add(itemValue)
      }
      onValueChange?.(Array.from(next))
    }
  }

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    onValueChange?.(type === "single" ? "" : [])
  }

  // 拼接显示的触发文本
  const triggerLabel = React.useMemo(() => {
    if (selectedValues.size === 0) {
      return prefix ? `${prefix}全部` : placeholder
    }
    if (type === "single") {
      const selectedItem = data.find(
        (item) => item.value === Array.from(selectedValues)[0]
      )
      return selectedItem
        ? prefix
          ? `${prefix}${selectedItem.label}`
          : selectedItem.label
        : placeholder
    }
    return prefix
      ? `${prefix}已选 ${selectedValues.size}`
      : `已选择 ${selectedValues.size} 项`
  }, [selectedValues, data, type, placeholder, prefix])

  const hasSelected = selectedValues.size > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "relative min-w-[140px] justify-start gap-2 truncate px-3 text-left font-normal",
            variant === "glass"
              ? "h-9 border-[var(--glass-border)] bg-[var(--glass-input-bg)] text-foreground backdrop-blur-[12px] transition-all hover:bg-[var(--glass-input-bg-hover)]"
              : "h-9",
            hasSelected && "border-primary/50",
            className
          )}
        >
          {icon && (
            <span className="shrink-0 text-muted-foreground">{icon}</span>
          )}
          <span className="flex-1 truncate pr-4">{triggerLabel}</span>

          {clearable && hasSelected && (
            <span
              role="button"
              tabIndex={0}
              className="absolute top-1/2 right-8 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation()
                  handleClear(e)
                }
              }}
            >
              <X className="size-3.5 shrink-0" />
            </span>
          )}

          <ChevronDown className="absolute top-1/2 right-3 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-md",
          popoverWidth
        )}
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {type === "single" && (
                <CommandItem
                  value={placeholder}
                  onSelect={() => {
                    onValueChange?.("")
                    setOpen(false)
                  }}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Check
                    className={cn(
                      "mr-2 size-4 shrink-0 text-[var(--lg-primary-light)] transition-opacity",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-sm font-medium">{placeholder}</span>
                </CommandItem>
              )}
              {data.map((item) => {
                const isSelected = selectedValues.has(item.value)
                return (
                  <CommandItem
                    key={item.value}
                    value={`${item.label} ${item.subLabel || ""}`.trim()}
                    onSelect={() => handleSelect(item.value)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    {type === "multiple" ? (
                      <>
                        <Checkbox
                          checked={isSelected}
                          className="pointer-events-none size-4"
                        />
                        <span className="truncate text-sm font-medium">
                          {item.label}
                        </span>
                        {item.subLabel && (
                          <span className="ml-3 truncate text-xs text-muted-foreground">
                            {item.subLabel}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Check
                          className={cn(
                            "mr-2 size-4 shrink-0 text-[var(--lg-primary-light)] transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col truncate">
                          <span className="truncate text-sm font-medium">
                            {item.label}
                          </span>
                          {item.subLabel && (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {item.subLabel}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

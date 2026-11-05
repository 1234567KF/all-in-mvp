"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  placeholder?: string
  align?: "start" | "center" | "end"
  className?: string
  disabledDates?: (date: Date) => boolean
}

/**
 * 日期范围选择器。
 *
 * 默认宽度 280px 只适合占位/紧凑场景；需要完整展示中文双日期时，在调用侧传
 * `className="w-fit max-w-full min-w-[260px]"`，让触发器按内容宽度自适应，
 * 避免「YYYY年MM月DD日 — …」被截断。
 */
export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "选择日期范围",
  align = "start",
  className,
  disabledDates,
}: DateRangePickerProps) {
  const isMobile = useIsMobile()

  return (
    <div className={cn("grid w-[280px] min-w-0 gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "h-8 justify-start gap-2 px-2.5 text-left font-normal",
              "w-full min-w-0 border-[var(--glass-border)] bg-[var(--glass-input-bg)] text-foreground backdrop-blur-[12px] transition-all hover:bg-[var(--glass-input-bg-hover)]",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 truncate text-sm">
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "yyyy年MM月dd日", { locale: zhCN })}{" "}
                    — {format(dateRange.to, "yyyy年MM月dd日", { locale: zhCN })}
                  </>
                ) : (
                  format(dateRange.from, "yyyy年MM月dd日", { locale: zhCN })
                )
              ) : (
                <span>{placeholder}</span>
              )}
            </div>
            {dateRange && (
              <span
                role="button"
                tabIndex={0}
                aria-label="清除日期"
                className="shrink-0 cursor-pointer rounded-sm p-0.5 transition-colors hover:bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation()
                  onDateRangeChange(undefined)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    onDateRangeChange(undefined)
                  }
                }}
              >
                <X className="size-3.5 text-muted-foreground/60 hover:text-foreground" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={isMobile ? 1 : 2}
            locale={zhCN}
            disabled={disabledDates}
            className="rounded-md border-0 bg-card/50 backdrop-blur-md"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

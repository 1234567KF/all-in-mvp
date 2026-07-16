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
              "h-9 justify-start gap-2 px-3 text-left font-normal",
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
              <button
                type="button"
                aria-label="清除日期"
                className="shrink-0 rounded-sm p-0.5 transition-colors hover:bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation()
                  onDateRangeChange(undefined)
                }}
              >
                <X className="size-3.5 text-muted-foreground/60 hover:text-foreground" />
              </button>
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

"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  align?: "start" | "center" | "end"
  className?: string
  disabledDates?: (date: Date) => boolean
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "选择日期",
  align = "start",
  className,
  disabledDates,
}: DatePickerProps) {
  return (
    <div className={cn("grid w-[240px] gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "h-9 justify-start gap-2 px-3 text-left font-normal",
              "w-full border-[var(--glass-border)] bg-[var(--glass-input-bg)] text-foreground backdrop-blur-[12px] transition-all hover:bg-[var(--glass-input-bg-hover)]",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 truncate text-sm">
              {date ? (
                format(date, "yyyy年MM月dd日", { locale: zhCN })
              ) : (
                <span>{placeholder}</span>
              )}
            </div>
            {date && (
              <span
                role="button"
                tabIndex={0}
                className="shrink-0 rounded-sm p-0.5 transition-colors hover:bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation()
                  onDateChange(undefined)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    onDateChange(undefined)
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
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={disabledDates}
            locale={zhCN}
            className="rounded-md border-0 bg-card/50 backdrop-blur-md"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

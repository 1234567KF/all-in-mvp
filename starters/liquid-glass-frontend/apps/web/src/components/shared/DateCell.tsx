import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDate, formatTimestamp } from "@/lib/date-utils"

interface DateCellProps {
  /** ISO 字符串 / Unix 毫秒时间戳 / null */
  value: string | number | null
  /** 额外的 className */
  className?: string
}

/**
 * 表格日期单元格：显示短日期（YYYY-MM-DD），hover 时 tooltip 显示完整时间。
 */
export function DateCell({ value, className }: DateCellProps) {
  const full = formatTimestamp(value)
  const short = formatDate(value)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className ?? "font-mono text-xs"}>{short}</span>
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  )
}

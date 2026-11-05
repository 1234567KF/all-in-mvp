/**
 * AuditLogFilters — 审计日志筛选栏（AuditLogPage 拆分）
 *
 * 桌面水平排列 / 移动端由 FilterBar 收进底部抽屉；筛选状态全部提升到页面层
 * （FilterBar 关闭抽屉即卸载 children，非受控控件会丢状态）。
 */
import { RotateCcw, Search } from "lucide-react"
import { useMemo } from "react"
import type { DateRange } from "react-day-picker"
import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_EVENT_TYPE_OPTIONS,
  AUDIT_MODULE_LABELS,
  AUDIT_MODULE_OPTIONS,
  AUDIT_RESULT_LABELS,
  AUDIT_RESULT_OPTIONS,
  AUDIT_SEVERITY_LABELS,
  AUDIT_SEVERITY_OPTIONS,
  type AuditEventType,
  MODULE_EVENT_TYPES,
} from "shared"

import { FilterBar } from "@/components/shared/FilterBar"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Select 的「全部」哨兵值：Radix Select 不允许空字符串作为 item value */
export const ALL_FILTER = "__all__"

export interface AuditLogFiltersState {
  module: string
  eventType: string
  result: string
  severity: string
  keyword: string
  dateRange: DateRange | undefined
}

export interface AuditLogFiltersProps extends AuditLogFiltersState {
  /** 移动端「筛选」按钮角标数 */
  activeFilterCount: number
  onModuleChange: (value: string) => void
  onEventTypeChange: (value: string) => void
  onResultChange: (value: string) => void
  onSeverityChange: (value: string) => void
  /** 关键字输入变化（页面层负责重置分页） */
  onKeywordChange: (value: string) => void
  onDateRangeChange: (value: DateRange | undefined) => void
  onReset: () => void
}

export function AuditLogFilters({
  module,
  eventType,
  result,
  severity,
  keyword,
  dateRange,
  activeFilterCount,
  onModuleChange,
  onEventTypeChange,
  onResultChange,
  onSeverityChange,
  onKeywordChange,
  onDateRangeChange,
  onReset,
}: AuditLogFiltersProps) {
  /** 级联筛选：选定模块后收窄事件类型选项（未收录模块回退全量） */
  const eventTypeOptions = useMemo<readonly AuditEventType[]>(() => {
    if (module === ALL_FILTER) return AUDIT_EVENT_TYPE_OPTIONS
    return MODULE_EVENT_TYPES[module] ?? AUDIT_EVENT_TYPE_OPTIONS
  }, [module])

  return (
    <div className="flex flex-1 items-center gap-3">
      <FilterBar
        sheetLabels={["模块", "事件类型", "结果", "严重程度", "时间范围", ""]}
        sheetTitle="筛选审计日志"
        activeFilterCount={activeFilterCount}
        search={
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2"
              style={{ color: "var(--lg-text-secondary)" }}
            />
            <Input
              placeholder="搜索操作人 / 对象 / 详情"
              className="h-9 w-[220px] pl-8 max-md:w-full"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
            />
          </div>
        }
      >
        <Select value={module} onValueChange={onModuleChange}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="全部模块" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>全部模块</SelectItem>
            {AUDIT_MODULE_OPTIONS.map((moduleOption) => (
              <SelectItem key={moduleOption} value={moduleOption}>
                {AUDIT_MODULE_LABELS[moduleOption]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventType} onValueChange={onEventTypeChange}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="全部事件" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>全部事件</SelectItem>
            {eventTypeOptions.map((eventTypeOption) => (
              <SelectItem key={eventTypeOption} value={eventTypeOption}>
                {AUDIT_EVENT_TYPE_LABELS[eventTypeOption]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={result} onValueChange={onResultChange}>
          <SelectTrigger className="h-9 w-[110px]">
            <SelectValue placeholder="全部结果" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>全部结果</SelectItem>
            {AUDIT_RESULT_OPTIONS.map((resultOption) => (
              <SelectItem key={resultOption} value={resultOption}>
                {AUDIT_RESULT_LABELS[resultOption]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severity} onValueChange={onSeverityChange}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="全部程度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>全部程度</SelectItem>
            {AUDIT_SEVERITY_OPTIONS.map((severityOption) => (
              <SelectItem key={severityOption} value={severityOption}>
                {AUDIT_SEVERITY_LABELS[severityOption]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          className="w-fit min-w-[260px]"
        />

        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          重置
        </Button>
      </FilterBar>
    </div>
  )
}

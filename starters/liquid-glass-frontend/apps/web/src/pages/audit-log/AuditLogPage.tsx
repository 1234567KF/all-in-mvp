/**
 * AuditLogPage — 审计日志查询页（B4 标杆查询页）
 *
 * 演示三件事：
 * 1. 服务端分页 + 多维筛选（筛选/翻页即新 query key，TanStack Query 自动缓存）；
 * 2. 权限消费：菜单与页面均按 audit:view 门控（后端 requirePermission 兜底）；
 * 3. 结构化变更渲染：详情弹窗复用 AuditDiffViewer（标量 / 标签 / 对象三态）。
 */
import { Eye, ShieldCheck } from "lucide-react"
import { type ComponentProps, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_MODULE_LABELS,
  AUDIT_RESULT_LABELS,
  AUDIT_SEVERITY_LABELS,
  type AuditEventType,
  type AuditLog,
  type AuditModule,
  type AuditResult,
  type AuditSeverity,
  PERMISSIONS,
} from "shared"

import { type ColumnDef, DataTable } from "@/components/shared/DataTable"
import { DateCell } from "@/components/shared/DateCell"
import {
  MobileCard,
  MobileCardMeta,
  MobileCardTags,
  MobileCardTitle,
} from "@/components/shared/MobileCard"
import { NullableText } from "@/components/shared/NullableText"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLogs } from "@/hooks/queries/useLogs"
import { usePermission } from "@/hooks/usePermission"
import { getLocalDayBoundaryISO } from "@/lib/date-utils"
import { EMPTY_VALUE, formatEmpty } from "@/lib/format"
import type { LogListParams } from "@/services/logs"

import { AuditLogDetailDialog } from "./components/AuditLogDetailDialog"
import { ALL_FILTER, AuditLogFilters } from "./components/AuditLogFilters"

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>

const PAGE_SIZE = 20

const RESULT_VARIANT: Record<string, BadgeVariant> = {
  success: "success",
  failure: "danger",
}

const SEVERITY_VARIANT: Record<string, BadgeVariant> = {
  info: "info",
  warning: "warning",
  error: "danger",
  critical: "danger",
}

function moduleLabel(module: string): string {
  return (AUDIT_MODULE_LABELS[module as AuditModule] ?? module) || EMPTY_VALUE
}

function eventTypeLabel(eventType: string): string {
  return (
    (AUDIT_EVENT_TYPE_LABELS[eventType as AuditEventType] ?? eventType) ||
    EMPTY_VALUE
  )
}

function resultLabel(result: string): string {
  return (AUDIT_RESULT_LABELS[result as AuditResult] ?? result) || EMPTY_VALUE
}

function severityLabel(severity: string): string {
  return (
    AUDIT_SEVERITY_LABELS[severity as AuditSeverity] ?? severity ?? EMPTY_VALUE
  )
}

/** 筛选值 → 查询参数（`__all__` 与空白视为未筛选） */
function toOptional(value: string): string | undefined {
  return value === ALL_FILTER || value.trim() === "" ? undefined : value
}

/** 表格里统一截断的文本单元格（hover 用原生 title 展示全文） */
function TruncatedCell({ value }: { value: string }) {
  const text = formatEmpty(value, EMPTY_VALUE)
  return (
    <span className="block max-w-[160px] truncate text-xs" title={text}>
      {text}
    </span>
  )
}

export default function AuditLogPage() {
  const { can } = usePermission()
  const canView = can(PERMISSIONS.AUDIT_VIEW)

  // ─── 筛选条件（状态提升到页面层，FilterBar 抽屉关闭不丢）───────────────
  const [moduleFilter, setModuleFilter] = useState(ALL_FILTER)
  const [eventTypeFilter, setEventTypeFilter] = useState(ALL_FILTER)
  const [resultFilter, setResultFilter] = useState(ALL_FILTER)
  const [severityFilter, setSeverityFilter] = useState(ALL_FILTER)
  const [keyword, setKeyword] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // ─── 服务端分页 + 详情弹窗 ────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  /** 筛选 / 翻页参数 → query key；变化即自动拉取 */
  const queryParams = useMemo<LogListParams>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      keyword: toOptional(keyword),
      module: toOptional(moduleFilter),
      eventType: toOptional(eventTypeFilter),
      result: toOptional(resultFilter) as AuditResult | undefined,
      severity: toOptional(severityFilter) as AuditSeverity | undefined,
      startTime: dateRange?.from
        ? getLocalDayBoundaryISO(dateRange.from, "start")
        : undefined,
      endTime: dateRange?.to
        ? getLocalDayBoundaryISO(dateRange.to, "end")
        : undefined,
    }),
    [
      page,
      keyword,
      moduleFilter,
      eventTypeFilter,
      resultFilter,
      severityFilter,
      dateRange,
    ]
  )

  const { data, isLoading } = useLogs(queryParams, { enabled: canView })
  const logs = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const activeFilterCount = [
    moduleFilter !== ALL_FILTER,
    eventTypeFilter !== ALL_FILTER,
    resultFilter !== ALL_FILTER,
    severityFilter !== ALL_FILTER,
    Boolean(dateRange?.from || dateRange?.to),
  ].filter(Boolean).length

  const isFiltered = activeFilterCount > 0 || keyword.trim() !== ""

  /** 筛选变化统一重置到第 1 页（React 18 同一事件内批量更新，只发一次请求） */
  const resetPage = () => setPage(1)

  const handleModuleChange = (value: string) => {
    setModuleFilter(value)
    setEventTypeFilter(ALL_FILTER) // 级联重置事件类型
    resetPage()
  }

  const resetFilters = () => {
    setModuleFilter(ALL_FILTER)
    setEventTypeFilter(ALL_FILTER)
    setResultFilter(ALL_FILTER)
    setSeverityFilter(ALL_FILTER)
    setKeyword("")
    setDateRange(undefined)
    resetPage()
  }

  // ─── 列定义 ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<AuditLog>[] = [
    {
      header: "模块",
      width: "w-[100px]",
      render: (row) => (
        <span style={{ color: "var(--lg-text-secondary)" }}>
          {moduleLabel(row.module)}
        </span>
      ),
    },
    {
      header: "审计对象",
      width: "w-[180px]",
      render: (row) => <TruncatedCell value={row.target} />,
    },
    {
      header: "事件类型",
      width: "w-[100px]",
      render: (row) => (
        <Badge variant="outline">{eventTypeLabel(row.eventType)}</Badge>
      ),
    },
    {
      header: "操作人",
      width: "w-[120px]",
      render: (row) => (
        <span className="block max-w-[120px] truncate">
          <NullableText value={row.operator} />
        </span>
      ),
    },
    {
      header: "结果",
      width: "w-[80px]",
      render: (row) => (
        <Badge variant={RESULT_VARIANT[row.result] ?? "outline"}>
          {resultLabel(row.result)}
        </Badge>
      ),
    },
    {
      header: "严重程度",
      width: "w-[90px]",
      render: (row) => (
        <Badge variant={SEVERITY_VARIANT[row.severity] ?? "outline"}>
          {severityLabel(row.severity)}
        </Badge>
      ),
    },
    {
      header: "审计时间",
      width: "w-[150px]",
      render: (row) => <DateCell value={row.createTime} />,
    },
    {
      header: "操作",
      width: "w-[70px]",
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => setSelectedLog(row)}
        >
          <Eye className="size-3.5" />
          详情
        </Button>
      ),
    },
  ]

  const header = (
    <div>
      <h1
        className="font-heading text-2xl font-bold tracking-tight md:text-3xl"
        style={{ color: "var(--lg-text-primary)" }}
      >
        审计日志
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--lg-text-secondary)" }}>
        记录系统关键操作的安全审计轨迹，支持按模块、事件、结果与时间范围筛选
      </p>
    </div>
  )

  // 无 audit:view 权限：不发起请求，直接展示权限提示（菜单同样隐藏）
  if (!canView) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {header}
        <div className="inset-card flex flex-col items-center gap-2 p-10 text-center">
          <ShieldCheck
            className="size-8"
            style={{ color: "var(--lg-text-muted)" }}
          />
          <p className="text-sm" style={{ color: "var(--lg-text-secondary)" }}>
            当前账号没有查看审计日志的权限（audit:view）
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {header}

      <DataTable<AuditLog>
        columns={columns}
        data={logs}
        loading={isLoading}
        total={total}
        rowKey="id"
        emptyIcon={ShieldCheck}
        emptyTitle="暂无审计日志"
        emptyDescription="没有找到符合筛选条件的审计日志"
        isFiltered={isFiltered}
        pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        onMobileCardClick={(row) => setSelectedLog(row)}
        mobileCard={(row) => (
          <MobileCard>
            <MobileCardTitle title={row.target || moduleLabel(row.module)}>
              <Badge variant={RESULT_VARIANT[row.result] ?? "outline"}>
                {resultLabel(row.result)}
              </Badge>
            </MobileCardTitle>
            <MobileCardTags>
              <Badge variant="outline">{eventTypeLabel(row.eventType)}</Badge>
              <span
                className="text-xs"
                style={{ color: "var(--lg-text-secondary)" }}
              >
                {moduleLabel(row.module)}
              </span>
            </MobileCardTags>
            <MobileCardMeta>
              <span>{row.operator || EMPTY_VALUE}</span>
              <DateCell
                value={row.createTime}
                className="font-mono text-[11px]"
              />
            </MobileCardMeta>
          </MobileCard>
        )}
        toolbar={
          <AuditLogFilters
            module={moduleFilter}
            eventType={eventTypeFilter}
            result={resultFilter}
            severity={severityFilter}
            keyword={keyword}
            dateRange={dateRange}
            activeFilterCount={activeFilterCount}
            onModuleChange={handleModuleChange}
            onEventTypeChange={(value) => {
              setEventTypeFilter(value)
              resetPage()
            }}
            onResultChange={(value) => {
              setResultFilter(value)
              resetPage()
            }}
            onSeverityChange={(value) => {
              setSeverityFilter(value)
              resetPage()
            }}
            onKeywordChange={(value) => {
              setKeyword(value)
              resetPage()
            }}
            onDateRangeChange={(range) => {
              setDateRange(range)
              resetPage()
            }}
            onReset={resetFilters}
          />
        }
      />

      <AuditLogDetailDialog
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}

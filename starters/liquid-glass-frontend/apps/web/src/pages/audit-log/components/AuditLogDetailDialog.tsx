/**
 * AuditLogDetailDialog — 审计日志详情弹窗
 *
 * 基础信息 / 设备与请求（UA 解析为可读标题）/ 变更明细（AuditDiffViewer）三段式。
 * 只消费 wire 的 AuditLog（changes 已在服务端解析为结构化对象），不直接解析 JSON。
 */
import { ShieldCheck } from "lucide-react"
import { type ComponentProps, useMemo } from "react"
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
} from "shared"

import { AuditDiffViewer } from "@/components/shared/AuditDiffViewer"
import { DetailRow } from "@/components/shared/DetailRow"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/shared/ResponsiveDialog"
import { SectionCard } from "@/components/shared/SectionCard"
import { Badge } from "@/components/ui/badge"
import { formatTimestamp } from "@/lib/date-utils"
import { parseUserAgent } from "@/lib/user-agent"

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>

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

const DEVICE_TYPE_LABELS: Record<string, string> = {
  desktop: "桌面端",
  mobile: "手机",
  tablet: "平板",
  cli: "命令行 / API 客户端",
  unknown: "未知",
}

/** 缺失值的统一占位 */
const EMPTY = "—"

export interface AuditLogDetailDialogProps {
  log: AuditLog | null
  onClose: () => void
}

export function AuditLogDetailDialog({
  log,
  onClose,
}: AuditLogDetailDialogProps) {
  const parsedUa = useMemo(
    () => parseUserAgent(log?.userAgent),
    [log?.userAgent]
  )

  return (
    <ResponsiveDialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <ShieldCheck
              className="size-5"
              style={{ color: "var(--lg-primary-light)" }}
            />
            审计日志详情
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {log && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <SectionCard title="基础信息">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailRow label="操作人" value={log.operator || EMPTY} />
                <DetailRow
                  label="操作人账号"
                  value={log.operatorAccount || EMPTY}
                />
                <DetailRow
                  label="操作人角色"
                  value={log.operatorRole || EMPTY}
                />
                <DetailRow
                  label="所属模块"
                  value={
                    (AUDIT_MODULE_LABELS[log.module as AuditModule] ??
                      log.module) ||
                    EMPTY
                  }
                />
                <DetailRow
                  label="事件类型"
                  value={
                    <Badge variant="outline">
                      {(AUDIT_EVENT_TYPE_LABELS[
                        log.eventType as AuditEventType
                      ] ??
                        log.eventType) ||
                        EMPTY}
                    </Badge>
                  }
                />
                <DetailRow
                  label="操作结果"
                  value={
                    <Badge variant={RESULT_VARIANT[log.result] ?? "outline"}>
                      {(AUDIT_RESULT_LABELS[log.result as AuditResult] ??
                        log.result) ||
                        EMPTY}
                    </Badge>
                  }
                />
                <DetailRow
                  label="严重程度"
                  value={
                    <Badge
                      variant={SEVERITY_VARIANT[log.severity] ?? "outline"}
                    >
                      {(AUDIT_SEVERITY_LABELS[log.severity as AuditSeverity] ??
                        log.severity) ||
                        EMPTY}
                    </Badge>
                  }
                />
                <DetailRow
                  label="审计时间"
                  value={formatTimestamp(log.createTime)}
                />
                <DetailRow label="审计对象" value={log.target || EMPTY} />
                <DetailRow
                  label="对象 ID"
                  value={
                    <span className="font-mono">{log.targetId || EMPTY}</span>
                  }
                />
              </div>
            </SectionCard>

            <SectionCard title="设备与请求">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailRow label="浏览器 / 系统" value={parsedUa.title} />
                <DetailRow
                  label="设备类型"
                  value={DEVICE_TYPE_LABELS[parsedUa.deviceType]}
                />
                <DetailRow label="IP 地址" value={log.ipAddress || EMPTY} />
                <DetailRow
                  label="Request ID"
                  value={
                    <span className="font-mono text-xs">
                      {log.requestId || EMPTY}
                    </span>
                  }
                />
                <div className="sm:col-span-2">
                  <DetailRow
                    label="原始 User-Agent"
                    value={
                      <span
                        className="text-xs break-all"
                        style={{ color: "var(--lg-text-secondary)" }}
                      >
                        {log.userAgent || EMPTY}
                      </span>
                    }
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="变更明细">
              <AuditDiffViewer changes={log.changes} />
            </SectionCard>

            {log.detail && (
              <SectionCard title="审计详情">
                <p
                  className="text-sm break-all"
                  style={{ color: "var(--lg-text-secondary)" }}
                >
                  {log.detail}
                </p>
              </SectionCard>
            )}
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

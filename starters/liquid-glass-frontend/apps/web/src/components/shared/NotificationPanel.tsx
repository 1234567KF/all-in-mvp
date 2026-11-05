/**
 * NotificationPanel — 业务无关的消息通知面板
 *
 * 纯展示 + 回调：不取数、不依赖路由、不依赖业务 store。
 * 业务侧通过 props 注入数据、类型注册表、正文高亮、跳转与操作回调。
 * 视觉与交互承接 CRM `NotificationPanel`：未读强调、99+ 角标、
 * hover 操作（触屏常显）、实体 chip、相对时间、空/加载/错误态。
 */
import { AlertTriangle, Bell, Check, CheckCheck, Inbox, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

import {
  DEFAULT_NOTIFICATION_TYPE_REGISTRY,
  formatUnreadCount,
  getUnreadCount,
  NOTIFICATION_TONE_STYLES,
  type NotificationEmphasis,
  type NotificationItem,
  type NotificationPanelProps,
  type NotificationTypeConfig,
  type NotificationTypeRegistry,
} from "./notification-config"
import { NotificationContent } from "./NotificationContent"

const DEFAULT_MAX_ITEMS = 50

// ─── 单条消息 ─────────────────────────────────────────────────────────────────

interface NotificationRowProps {
  notification: NotificationItem
  typeConfig: NotificationTypeConfig
  emphasis?: readonly NotificationEmphasis[]
  formatTime: (iso: string) => string
  markReadOnClick: boolean
  renderContent?: (notification: NotificationItem) => React.ReactNode
  onItemClick?: (notification: NotificationItem) => void
  onMarkRead?: (notification: NotificationItem) => void
  onDelete?: (notification: NotificationItem) => void
}

function NotificationRow({
  notification,
  typeConfig,
  emphasis,
  formatTime,
  markReadOnClick,
  renderContent,
  onItemClick,
  onMarkRead,
  onDelete,
}: NotificationRowProps) {
  const isUnread = !notification.read
  // 行级可点击语义：有导航回调，或当前未读且允许“点击标记已读”
  const clickable =
    Boolean(onItemClick) || (markReadOnClick && isUnread && Boolean(onMarkRead))
  const Icon = typeConfig.icon ?? Bell
  const toneStyle = NOTIFICATION_TONE_STYLES[typeConfig.tone ?? "neutral"]

  const handleClick = () => {
    if (markReadOnClick && isUnread) {
      onMarkRead?.(notification)
    }
    onItemClick?.(notification)
  }

  const hasActions =
    (isUnread && onMarkRead !== undefined) || onDelete !== undefined
  const timeText = formatTime(notification.createdAt)

  return (
    <div
      className={cn(
        "group relative flex w-full items-start px-4 py-3.5 transition-colors",
        clickable ? "cursor-pointer" : "cursor-default",
        isUnread && "bg-[var(--lg-surface-high)]/40",
        clickable &&
          (isUnread
            ? "hover:bg-[var(--lg-surface-high)]/70"
            : "hover:bg-[var(--lg-surface-high)]/30")
      )}
    >
      {/* 整行点击/键盘激活使用覆盖层按钮，与行内 actions 为兄弟节点，
          避免 role=button 内嵌真实 button 的 ARIA/键盘冒泡问题 */}
      {clickable && (
        <button
          type="button"
          aria-label={`${isUnread ? "未读，" : ""}${notification.title}，${timeText}。${notification.content}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-none border-none bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-[var(--lg-primary-text)] focus-visible:outline-none focus-visible:ring-inset"
          onClick={handleClick}
        />
      )}

      {/* 视觉内容；可点击时对读屏隐藏并让点击穿透到覆盖层按钮 */}
      <div
        className={cn(
          "relative z-20 flex w-full items-start gap-3.5",
          clickable && "pointer-events-none",
          // 触屏下 actions 常显在行右上角，整块内容给 44px 触控按钮预留空间
          hasActions && "pointer-coarse:pr-24"
        )}
        aria-hidden={clickable || undefined}
      >
        {/* 图标区：未读时按业务 tone 着色，并显示同色未读点 */}
        <div className="relative flex-shrink-0 pt-0.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg transition-colors"
            style={{
              backgroundColor: isUnread
                ? toneStyle.iconBackground
                : "var(--lg-surface-bright)",
            }}
          >
            <Icon
              className="size-4 transition-colors"
              style={{
                color: isUnread ? toneStyle.iconColor : "var(--lg-text-muted)",
              }}
              aria-hidden="true"
            />
          </div>
          {isUnread && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[var(--lg-surface)]"
              style={{ background: toneStyle.dotColor }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* 内容区 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className="truncate text-sm font-semibold"
              style={{
                color: isUnread
                  ? "var(--lg-text-primary)"
                  : "var(--lg-text-secondary)",
              }}
            >
              {notification.title}
              {isUnread && <span className="sr-only">未读</span>}
            </p>

            <div className="relative flex h-5 min-w-[50px] flex-shrink-0 items-center justify-end">
              <span
                className="text-[11px] transition-opacity duration-150 group-focus-within:pointer-events-none group-focus-within:opacity-0 group-hover:pointer-events-none group-hover:opacity-0 pointer-coarse:group-focus-within:pointer-events-auto pointer-coarse:group-focus-within:opacity-100 pointer-coarse:group-hover:pointer-events-auto pointer-coarse:group-hover:opacity-100"
                style={{ color: "var(--lg-text-secondary)" }}
              >
                {/* 非法时间不渲染 <time dateTime>（非法 dateTime 值不符合 HTML 语义），降级为普通文本 */}
                {Number.isNaN(Date.parse(notification.createdAt)) ? (
                  <span>{timeText}</span>
                ) : (
                  <time dateTime={notification.createdAt}>{timeText}</time>
                )}
              </span>
            </div>
          </div>

          {/* 正文说明 */}
          <div className="mt-1 text-xs leading-relaxed text-[var(--lg-text-secondary)]">
            {renderContent ? (
              renderContent(notification)
            ) : (
              <NotificationContent
                content={notification.content}
                emphasis={emphasis}
              />
            )}
          </div>
        </div>
      </div>

      {/* 行内操作：悬停/键盘聚焦时显示；触屏下常显。
          触屏按钮直接做成 44px（pointer-coarse:size-11），不使用会相互重叠的 .touch-hit 伪元素命中区 */}
      {hasActions && (
        <div className="pointer-events-none absolute top-3.5 right-4 z-30 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100">
          {isUnread && onMarkRead && (
            <button
              type="button"
              className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--lg-surface-bright)] focus-visible:ring-2 focus-visible:ring-[var(--lg-primary-text)] focus-visible:outline-none pointer-coarse:size-11 pointer-coarse:p-0"
              style={{ color: "var(--lg-text-muted)" }}
              onClick={(event) => {
                event.stopPropagation()
                onMarkRead(notification)
              }}
              title="标记已读"
              aria-label={`标记已读：${notification.title}`}
            >
              <Check className="size-3.5 hover:text-[var(--lg-primary)]" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--lg-surface-bright)] focus-visible:ring-2 focus-visible:ring-[var(--lg-primary-text)] focus-visible:outline-none pointer-coarse:size-11 pointer-coarse:p-0"
              style={{ color: "var(--lg-text-muted)" }}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(notification)
              }}
              title="删除通知"
              aria-label={`删除通知：${notification.title}`}
            >
              <X className="size-3.5 hover:text-[var(--lg-danger)]" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 状态视图 ─────────────────────────────────────────────────────────────────

function NotificationLoadingRows() {
  return (
    <div className="space-y-4 px-4 py-3.5" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3.5">
          <Skeleton className="size-8 flex-shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function NotificationEmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Inbox
        className="mb-2 size-10"
        style={{ color: "var(--lg-text-muted)" }}
        aria-hidden="true"
      />
      <span className="text-sm" style={{ color: "var(--lg-text-secondary)" }}>
        {text}
      </span>
    </div>
  )
}

function NotificationErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center"
      role="alert"
    >
      <AlertTriangle
        className="size-8"
        style={{ color: "var(--lg-danger)" }}
        aria-hidden="true"
      />
      <span className="text-sm" style={{ color: "var(--lg-text-secondary)" }}>
        {message}
      </span>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="focus-visible:ring-2 focus-visible:ring-[var(--lg-primary-text)] focus-visible:ring-offset-0"
          onClick={onRetry}
        >
          重试
        </Button>
      )}
    </div>
  )
}

// ─── 主面板 ───────────────────────────────────────────────────────────────────

export function NotificationPanel({
  notifications,
  unreadCount,
  loading = false,
  error = null,
  title = "消息通知",
  emptyText = "暂无新消息",
  maxItems = DEFAULT_MAX_ITEMS,
  maxHeight = 400,
  typeRegistry,
  emphasis,
  renderContent,
  formatTime = formatRelativeTime,
  markReadOnClick = true,
  className,
  onItemClick,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onRetry,
  footer,
}: NotificationPanelProps) {
  const resolvedUnread = unreadCount ?? getUnreadCount(notifications)
  const visibleNotifications = notifications.slice(0, maxItems)
  const hasItems = visibleNotifications.length > 0
  const showLoading = loading && !hasItems
  const showError = !loading && Boolean(error) && !hasItems
  const showEmpty = !loading && !error && !hasItems
  // live region 文案：加载中 / 空态 / 未读数变化。错误态由 NotificationErrorState
  // 的 role="alert" 播报，这里留空避免重复播报。
  const liveStatusText = loading
    ? "加载中..."
    : showEmpty
      ? emptyText
      : showError
        ? ""
        : `${resolvedUnread} 条未读`

  const mergedRegistry = React.useMemo<NotificationTypeRegistry>(
    () => ({ ...DEFAULT_NOTIFICATION_TYPE_REGISTRY, ...typeRegistry }),
    [typeRegistry]
  )

  const resolvedMaxHeight =
    typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight

  return (
    <section
      aria-label={title}
      aria-busy={loading || undefined}
      className={cn("flex w-full flex-col", className)}
    >
      {/* 读屏播报（本面板唯一 live region）：
          未读数变化 / 加载 / 空态文案统一从这里播报；错误态由
          NotificationErrorState 的 role="alert" 播报，这里留空避免重复。 */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveStatusText}
      </span>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--lg-border-subtle)] px-4 py-3">
        <h3
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--lg-text-primary)" }}
        >
          {title}
          {resolvedUnread > 0 && (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
              style={{
                background: "var(--lg-danger)",
                color: "var(--lg-on-primary)",
              }}
              aria-hidden="true"
            >
              {formatUnreadCount(resolvedUnread)}
            </span>
          )}
        </h3>
        {resolvedUnread > 0 && onMarkAllRead && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--lg-primary-text)] focus-visible:ring-offset-0"
            onClick={onMarkAllRead}
          >
            <CheckCheck className="mr-1 size-3.5" aria-hidden="true" />
            全部已读
          </Button>
        )}
      </div>

      {/* List：maxHeight 必须作用在 Viewport 上；Root 高度是 auto，
          Viewport 的 size-full 无法解析百分比高度，会导致内容被裁切而不滚动 */}
      <ScrollArea
        className="w-full overflow-hidden"
        style={
          {
            "--notification-list-max-height": resolvedMaxHeight,
          } as React.CSSProperties
        }
        viewportClassName="max-h-[var(--notification-list-max-height)]"
      >
        {showLoading ? (
          <NotificationLoadingRows />
        ) : showError ? (
          <NotificationErrorState
            message={error ?? "加载消息失败"}
            onRetry={onRetry}
          />
        ) : showEmpty ? (
          <NotificationEmptyState text={emptyText} />
        ) : (
          <div className="divide-y divide-[var(--lg-border-subtle)]">
            {visibleNotifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                typeConfig={mergedRegistry[notification.type ?? ""] ?? {}}
                emphasis={emphasis}
                formatTime={formatTime}
                markReadOnClick={markReadOnClick}
                renderContent={renderContent}
                onItemClick={onItemClick}
                onMarkRead={onMarkRead}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {footer && (
        <div className="border-t border-[var(--lg-border-subtle)] p-2">
          {footer}
        </div>
      )}
    </section>
  )
}

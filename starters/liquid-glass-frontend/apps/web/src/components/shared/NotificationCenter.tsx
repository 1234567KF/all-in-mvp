/**
 * NotificationCenter — 顶栏消息中心薄组合
 *
 * `Popover + NotificationBell + NotificationPanel`，只管理开合与导航回调后的关闭，
 * 数据、业务类型、跳转全部由 props 注入。需要自定义触发器时可直接传 `trigger`。
 */
import * as React from "react"

import { NotificationBell } from "@/components/shared/NotificationBell"
import { NotificationPanel } from "@/components/shared/NotificationPanel"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import {
  getUnreadCount,
  type NotificationItem,
  type NotificationPanelProps,
} from "./notification-config"

export interface NotificationCenterProps extends NotificationPanelProps {
  /** 弹层对齐方式，默认 end */
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  /** 弹层与触发器的间距，默认 8 */
  sideOffset?: number
  /** 受控开合 */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** 自定义触发器（需支持 ref 透传），默认 NotificationBell */
  trigger?: React.ReactElement
  /** Popover 内容容器 class（背景/边框等）；Panel 宽度由 Center 提供 */
  contentClassName?: string
}

export function NotificationCenter({
  align = "end",
  sideOffset = 8,
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  contentClassName,
  onItemClick,
  ...panelProps
}: NotificationCenterProps) {
  const { className: panelClassName, ...restPanelProps } = panelProps
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const isControlled = open !== undefined
  const actualOpen = isControlled ? open : internalOpen

  const resolvedUnread =
    restPanelProps.unreadCount ?? getUnreadCount(restPanelProps.notifications)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  // 只有业务提供了导航回调时才注入行点击；否则保留 Panel 的只读/仅标记已读语义
  const handleItemClick = onItemClick
    ? (notification: NotificationItem) => {
        onItemClick(notification)
        handleOpenChange(false)
      }
    : undefined

  return (
    <Popover open={actualOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <NotificationBell
            unreadCount={resolvedUnread}
            label={restPanelProps.title ?? "消息通知"}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        aria-label={restPanelProps.title ?? "消息通知"}
        className={cn(
          "w-auto border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-elevated)] p-0 shadow-lg backdrop-blur-xl",
          contentClassName
        )}
      >
        <NotificationPanel
          {...restPanelProps}
          className={cn("w-[min(390px,calc(100vw-2rem))]", panelClassName)}
          unreadCount={resolvedUnread}
          onItemClick={handleItemClick}
        />
      </PopoverContent>
    </Popover>
  )
}

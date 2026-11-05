/**
 * NotificationBell — 消息中心触发器
 *
 * 只负责铃铛按钮与未读角标（> maxCount 显示 "99+"），
 * 不含弹层与数据逻辑，可单独用于任意工具栏 / 自定义 Popover。
 */
import { Bell } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { formatUnreadCount } from "./notification-config"

export interface NotificationBellProps extends Omit<
  React.ComponentProps<typeof Button>,
  "children"
> {
  /** 未读数，0 时不渲染角标 */
  unreadCount?: number
  /** 角标上限，超过显示 `${maxCount}+`，默认 99 */
  maxCount?: number
  /** 无障碍名称 / title，默认「消息通知」 */
  label?: string
}

export function NotificationBell({
  unreadCount = 0,
  maxCount = 99,
  label = "消息通知",
  className,
  ...props
}: NotificationBellProps) {
  const badgeText = formatUnreadCount(unreadCount, maxCount)
  const ariaLabel = unreadCount > 0 ? `${label}，${unreadCount} 条未读` : label

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={ariaLabel}
      title={label}
      className={cn(
        "relative size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)]",
        className
      )}
      {...props}
    >
      <Bell className="size-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold"
          style={{
            background: "var(--lg-danger)",
            color: "var(--lg-on-primary)",
          }}
          aria-hidden="true"
        >
          {badgeText}
        </span>
      )}
    </Button>
  )
}

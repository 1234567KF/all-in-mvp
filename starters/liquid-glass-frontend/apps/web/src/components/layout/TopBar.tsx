import { Palette, Search, Settings } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { NotificationCenter } from "@/components/shared/NotificationCenter"
import { ThemeColorPicker } from "@/components/shared/ThemeColorPicker"
import { UserMenu } from "@/components/shared/UserMenu"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "@/hooks/queries/useNotifications"
import { useNotificationStream } from "@/hooks/queries/useNotificationStream"
import { extractErrorMessage } from "@/lib/errors"
import { getPageTitle } from "@/lib/menu-config"
import { showInfo } from "@/lib/toast"
import { useAuthStore } from "@/stores/auth"

interface TopBarProps {
  onSearchOpen: () => void
  isMac: boolean
}

export function TopBar({ onSearchOpen, isMac }: TopBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const accessToken = useAuthStore((state) => state.accessToken)
  const isAuthenticated = Boolean(accessToken)
  // 消息中心接真实后端：列表 / 未读数走 Query hooks，写操作走 mutations
  // （乐观更新 + 失效），SSE 事件到达时自动刷新列表与角标。
  // enabled 绑定登录态：即使将来 TopBar 被复用到公开布局也不会发未认证请求。
  const {
    data: notificationPage,
    isLoading: isNotificationsLoading,
    isFetching: isNotificationsFetching,
    isError: isNotificationsError,
    error: notificationsError,
    refetch: refetchNotifications,
  } = useNotifications({ limit: 20, enabled: isAuthenticated })
  const { data: unreadCount = 0 } = useUnreadCount({
    enabled: isAuthenticated,
  })
  const { mutate: markRead } = useMarkRead()
  const { mutate: markAllRead } = useMarkAllRead()
  const { mutate: removeNotification } = useDeleteNotification()
  useNotificationStream()

  const notifications = notificationPage?.items ?? []

  return (
    <header
      className="sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center px-4 sm:px-8 lg:grid-cols-[1fr_auto_1fr]"
      style={{
        height: "var(--topbar-height)",
        background: "var(--lg-surface-glass)",
        backdropFilter: "blur(var(--glass-blur-heavy))",
        WebkitBackdropFilter: "blur(var(--glass-blur-heavy))",
        borderBottom: "1px solid var(--lg-border-subtle)",
      }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <SidebarTrigger className="flex-shrink-0" />
        <h1
          className="truncate text-lg font-bold"
          title={getPageTitle(location.pathname)}
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--lg-text-primary)",
          }}
        >
          {getPageTitle(location.pathname)}
        </h1>
      </div>

      {/* Search Trigger Button */}
      <div className="relative mx-8 hidden w-[400px] lg:block">
        <button
          type="button"
          onClick={onSearchOpen}
          className="glass-input flex w-full cursor-pointer items-center justify-between rounded-full py-2 pr-3 !pl-10 text-left text-sm text-on-surface-variant transition-all hover:bg-[var(--lg-surface-high)]"
        >
          <span>搜索组件或页面...</span>
          <kbd className="pointer-events-none hidden h-5 items-center gap-1 rounded border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-elevated)] px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex">
            <span className="text-xs leading-none">{isMac ? "⌘" : "Ctrl"}</span>
            <span className="leading-none">K</span>
          </kbd>
        </button>
        <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-[18px] -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Topbar Actions */}
      <div className="flex items-center gap-2 justify-self-end">
        <Button
          variant="ghost"
          size="icon"
          aria-label="搜索"
          title="搜索"
          onClick={onSearchOpen}
          className="size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)] lg:hidden"
        >
          <Search className="size-5" aria-hidden="true" />
        </Button>
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadCount}
          loading={isNotificationsLoading || isNotificationsFetching}
          error={
            isNotificationsError
              ? extractErrorMessage(notificationsError)
              : null
          }
          onMarkRead={(notification) => markRead(notification.id)}
          onMarkAllRead={() => markAllRead()}
          onDelete={(notification) => removeNotification(notification.id)}
          onRetry={() => void refetchNotifications()}
          onItemClick={(notification) => {
            if (notification.href) {
              navigate(notification.href, { viewTransition: true })
            } else {
              showInfo("该消息没有关联页面")
            }
          }}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="切换主题色"
              title="切换主题色"
              className="size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)]"
            >
              <Palette className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            collisionPadding={8}
            className="w-72 border border-[var(--lg-border)] bg-[var(--popover)] p-4 shadow-xl backdrop-blur-[var(--glass-blur-heavy)]"
          >
            <PopoverHeader>
              <PopoverTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Palette
                  className="size-4"
                  style={{ color: "var(--lg-primary-light)" }}
                  aria-hidden="true"
                />
                主题色
              </PopoverTitle>
              <PopoverDescription className="text-xs text-[var(--lg-text-secondary)]">
                独立于深色 / 浅色模式，选择后自动保存
              </PopoverDescription>
            </PopoverHeader>
            <ThemeColorPicker />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          aria-label="个人设置"
          title="个人设置"
          className="hidden size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)] md:inline-flex"
          onClick={() => navigate("/settings")}
        >
          <Settings className="size-5" aria-hidden="true" />
        </Button>
        <Separator
          orientation="vertical"
          className="mx-1 h-6 !self-center bg-[var(--lg-border)]"
        />
        <UserMenu />
      </div>
    </header>
  )
}

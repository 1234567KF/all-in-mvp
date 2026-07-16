import { Bell, Search, Settings } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { UserMenu } from "@/components/shared/UserMenu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getPageTitle } from "@/lib/menu-config"

interface TopBarProps {
  onSearchOpen: () => void
  isMac: boolean
}

export function TopBar({ onSearchOpen, isMac }: TopBarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <header
      className="sticky top-0 z-40 grid grid-cols-2 items-center px-4 sm:px-8 lg:grid-cols-[1fr_auto_1fr]"
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
          onClick={onSearchOpen}
          className="size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)] lg:hidden"
        >
          <Search className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)]"
        >
          <Bell className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border-none text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)]"
          onClick={() => navigate("/settings")}
        >
          <Settings className="size-5" />
        </Button>
        <Separator
          orientation="vertical"
          className="mx-1 h-6 bg-[var(--lg-border)]"
        />
        <UserMenu />
      </div>
    </header>
  )
}

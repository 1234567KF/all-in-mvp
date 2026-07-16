import { useEffect, useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"

import RouteErrorBoundary from "@/components/layout/RouteErrorBoundary"
import { TopBar } from "@/components/layout/TopBar"
import { CommandPalette } from "@/components/shared/CommandPalette"
import { ModeToggle } from "@/components/shared/mode-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { menuGroups } from "@/lib/menu-config"
import { useLayoutStore } from "@/stores/layoutStore"

function SidebarMenuContent() {
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarContent>
      {menuGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--lg-text-muted)",
            }}
          >
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const isActive =
                item.path === "/components"
                  ? location.pathname === "/components"
                  : item.path === "/dashboard"
                    ? location.pathname === "/dashboard"
                    : location.pathname.startsWith(item.path)
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.title}
                  >
                    <Link
                      to={item.path}
                      viewTransition
                      onClick={handleLinkClick}
                    >
                      <item.icon
                        className="size-5"
                        style={
                          isActive
                            ? {
                                filter:
                                  "drop-shadow(0 0 8px var(--lg-primary-glow))",
                              }
                            : undefined
                        }
                      />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}

export default function SidebarLayout() {
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [isMac] = useState(() =>
    /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent)
  )
  const layoutWidth = useLayoutStore((s) => s.layoutWidth)

  const maxWidth =
    layoutWidth === "standard"
      ? 1280
      : layoutWidth === "wide"
        ? 1600
        : undefined

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar className="border-r border-[var(--lg-border-subtle)] bg-[var(--lg-surface-elevated)] backdrop-blur-xl">
          {/* Brand */}
          <SidebarHeader className="px-6 py-8">
            <div className="flex items-center gap-4 pl-1">
              <div
                className="flex size-9 items-center justify-center rounded-lg text-lg font-bold"
                style={{
                  background: "var(--lg-primary-dim)",
                  color: "var(--lg-primary-light)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                G
              </div>
              <div>
                <h1
                  className="text-xl leading-tight font-bold tracking-[-0.01em]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--lg-primary-light)",
                  }}
                >
                  Liquid Glass
                </h1>
                <p
                  className="mt-0.5 text-[11px] font-medium tracking-[0.05em] uppercase opacity-70"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--lg-text-secondary)",
                  }}
                >
                  Design System
                </p>
              </div>
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarMenuContent />

          {/* Footer */}
          <SidebarFooter className="border-t border-[var(--lg-border-subtle)] p-4">
            <div className="flex items-center justify-between px-2">
              <span className="font-mono text-xs text-outline">v0.1.0</span>
              <ModeToggle />
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Area */}
        <SidebarInset className="min-w-0 bg-transparent">
          {/* TopBar */}
          <TopBar onSearchOpen={() => setSearchOpen(true)} isMac={isMac} />

          {/* Command Dialog */}
          <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

          {/* Page Content */}
          <div
            className="mx-auto w-full min-w-0 flex-1"
            style={{
              padding: "var(--spacing-page)",
              maxWidth,
            }}
          >
            <RouteErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

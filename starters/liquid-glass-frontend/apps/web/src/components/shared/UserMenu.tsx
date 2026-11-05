import { LogOut, User } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/stores/auth"

export function UserMenu() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const userInitial = user?.name?.charAt(0) ?? "A"
  // stores/auth 的 User 目前仅有 name/email；roleName/phone 为可选扩展字段（后端接入后补充到 store 类型）
  const extra = user as { roleName?: string; phone?: string } | null
  const userRoleText =
    [extra?.roleName, extra?.phone].filter(Boolean).join(" · ") || "ADMIN"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar
          className="size-8 shrink-0 cursor-pointer ring-2 ring-transparent transition-all hover:scale-105 hover:ring-[var(--lg-primary)]/30 active:scale-95"
          style={{
            background: "var(--lg-primary)",
            color: "var(--lg-on-primary)",
            border: "1px solid var(--lg-border-subtle)",
          }}
        >
          <AvatarFallback
            className="text-xs font-semibold select-none"
            style={{
              background: "var(--lg-primary)",
              color: "var(--lg-on-primary)",
            }}
          >
            {userInitial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl border border-[var(--lg-border-subtle)] bg-[var(--popover)] p-1.5 text-[var(--popover-foreground)] shadow-xl backdrop-blur-xl"
      >
        <div className="px-2.5 py-2">
          <p
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--lg-text-primary)" }}
          >
            {user?.name || "管理员"}
          </p>
          <p
            className="mt-0.5 truncate text-xs font-normal"
            style={{ color: "var(--lg-text-muted)" }}
          >
            {userRoleText}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            onClick={() => navigate("/settings", { viewTransition: true })}
          >
            <User className="size-4 text-[var(--lg-text-secondary)] transition-colors group-focus/dropdown-menu-item:text-[var(--lg-text-primary)]" />
            <span>个人设置</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            onClick={() => {
              if (confirm("确定退出登录吗？")) {
                clearAuth()
                navigate("/login", { viewTransition: true })
              }
            }}
          >
            <LogOut className="size-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

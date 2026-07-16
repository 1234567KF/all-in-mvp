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
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar
          className="size-8 shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          style={{
            background: "var(--lg-primary)",
            color: "var(--lg-on-primary)",
            border: "1px solid var(--lg-border)",
          }}
        >
          <AvatarFallback
            className="text-xs font-semibold"
            style={{
              background: "var(--lg-primary)",
              color: "var(--lg-on-primary)",
            }}
          >
            A
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-elevated)] backdrop-blur-xl"
      >
        <div className="px-2 py-1.5 font-mono text-xs font-medium text-[var(--lg-text-muted)]">
          ADMIN
        </div>
        <DropdownMenuSeparator className="bg-[var(--lg-border-subtle)]" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer gap-2 focus:bg-[var(--lg-surface-high)] focus:text-[var(--lg-text-primary)]"
            onClick={() => navigate("/settings", { viewTransition: true })}
          >
            <User
              className="text-on-surface-variant"
              data-icon="inline-start"
            />
            <span>个人设置</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--lg-border-subtle)]" />
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => {
              if (confirm("确定退出登录吗？")) {
                clearAuth()
                navigate("/login", { viewTransition: true })
              }
            }}
          >
            <LogOut className="text-destructive" data-icon="inline-start" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

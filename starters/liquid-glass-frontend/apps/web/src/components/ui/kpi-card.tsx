import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type KpiColor =
  | "green"
  | "blue"
  | "red"
  | "purple"
  | "yellow"
  | "default"

export interface KpiCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  accentColor?: KpiColor
  trend?: {
    value: string | number
    direction: "up" | "down" | "flat"
    label?: string
  }
  className?: string
  loading?: boolean
}

const colorConfig = {
  green: {
    hoverBorder: "hover:border-[var(--lg-primary-border)]",
    blobBg:
      "bg-[var(--lg-primary-dim)]/40 group-hover:bg-[var(--lg-primary-dim)]/80",
    barBg: "bg-[var(--lg-primary)] shadow-[0_0_8px_var(--lg-primary-glow)]",
    trendColor: "text-[var(--lg-primary-light)]",
    iconColor: "text-[var(--lg-primary-light)]",
    iconBg: "bg-[var(--lg-primary-dim)]",
  },
  blue: {
    hoverBorder: "hover:border-[var(--lg-accent-blue-border)]",
    blobBg:
      "bg-[var(--lg-accent-blue-dim)]/40 group-hover:bg-[var(--lg-accent-blue-dim)]/80",
    barBg:
      "bg-[var(--lg-accent-blue)] shadow-[0_0_8px_var(--lg-accent-blue-glow)]",
    trendColor: "text-[var(--lg-accent-blue-light)]",
    iconColor: "text-[var(--lg-accent-blue-light)]",
    iconBg: "bg-[var(--lg-accent-blue-dim)]",
  },
  red: {
    hoverBorder: "hover:border-[var(--lg-accent-red-border)]",
    blobBg:
      "bg-[var(--lg-accent-red-dim)]/40 group-hover:bg-[var(--lg-accent-red-dim)]/80",
    barBg:
      "bg-[var(--lg-accent-red)] shadow-[0_0_8px_var(--lg-accent-red-glow)]",
    trendColor: "text-[var(--lg-accent-red-light)]",
    iconColor: "text-[var(--lg-accent-red-light)]",
    iconBg: "bg-[var(--lg-accent-red-dim)]",
  },
  purple: {
    hoverBorder: "hover:border-[var(--lg-accent-purple-border)]",
    blobBg:
      "bg-[var(--lg-accent-purple-dim)]/40 group-hover:bg-[var(--lg-accent-purple-dim)]/80",
    barBg:
      "bg-[var(--lg-accent-purple)] shadow-[0_0_8px_var(--lg-accent-purple-glow)]",
    trendColor: "text-[var(--lg-accent-purple-light)]",
    iconColor: "text-[var(--lg-accent-purple-light)]",
    iconBg: "bg-[var(--lg-accent-purple-dim)]",
  },
  yellow: {
    hoverBorder: "hover:border-[var(--lg-accent-yellow-border)]",
    blobBg:
      "bg-[var(--lg-accent-yellow-dim)]/40 group-hover:bg-[var(--lg-accent-yellow-dim)]/80",
    barBg:
      "bg-[var(--lg-accent-yellow)] shadow-[0_0_8px_var(--lg-accent-yellow-glow)]",
    trendColor: "text-[var(--lg-accent-yellow-light)]",
    iconColor: "text-[var(--lg-accent-yellow-light)]",
    iconBg: "bg-[var(--lg-accent-yellow-dim)]",
  },
  default: {
    hoverBorder: "hover:border-[var(--lg-border)]",
    blobBg: "bg-transparent",
    barBg: "bg-[var(--lg-border)]",
    trendColor: "text-muted-foreground",
    iconColor: "text-muted-foreground",
    iconBg: "bg-[var(--lg-border-subtle)]",
  },
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  accentColor = "default",
  trend,
  className,
  loading = false,
}: KpiCardProps) {
  const cfg = colorConfig[accentColor] || colorConfig.default

  if (loading) {
    return (
      <Card className="glass-card py-0">
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      role="region"
      aria-label={title}
      className={cn(
        "glass-card group relative overflow-hidden py-0 ring-0 transition-all",
        cfg.hoverBorder,
        className
      )}
    >
      <CardContent className="relative z-10 p-6">
        {/* Glow Blob */}
        <div
          className={cn(
            "pointer-events-none absolute top-0 right-0 z-0 -mt-10 -mr-10 h-32 w-32 rounded-full blur-[32px] transition-colors duration-300",
            cfg.blobBg
          )}
        />

        <div className="relative z-10 mb-3 flex items-start justify-between">
          <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {title}
          </span>
          {Icon && (
            <div
              className={cn("rounded-lg p-1.5 transition-colors", cfg.iconBg)}
            >
              <Icon className={cn("size-4", cfg.iconColor)} />
            </div>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className={cn("h-8 w-0.5 rounded-sm", cfg.barBg)} />
          <span className="font-data-display leading-none text-foreground">
            {value}
          </span>
        </div>

        {trend && (
          <div
            className={cn(
              "relative z-10 mt-4 flex items-center gap-1 font-mono text-[11px]",
              trend.direction === "up" && "text-emerald-500",
              trend.direction === "down" && "text-red-500",
              trend.direction === "flat" && "text-muted-foreground"
            )}
          >
            {trend.direction === "up" && (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            )}
            {trend.direction === "down" && (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {trend.direction === "flat" && (
              <Minus className="size-3.5" aria-hidden="true" />
            )}
            <span>
              {trend.value} {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

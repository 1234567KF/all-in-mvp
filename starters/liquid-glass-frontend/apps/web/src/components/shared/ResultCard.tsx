import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"

export interface ResultCardProps {
  type: "success" | "error" | "warning" | "info"
  title: string
  description?: string
  extra?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

type ResultKind = ResultCardProps["type"]

interface ResultVisualConfig {
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
  glowColor: string
  accentColor: string
}

export default function ResultCard({
  type,
  title,
  description,
  extra,
  actions,
  className = "",
}: ResultCardProps) {
  const configs: Record<ResultKind, ResultVisualConfig> = {
    success: {
      icon: CheckCircle2,
      colorClass:
        "text-[var(--lg-primary-light)] bg-[var(--lg-primary-dim)] border-[var(--lg-primary-border)]",
      glowColor: "var(--lg-primary-glow)",
      accentColor: "var(--lg-primary-light)",
    },
    error: {
      icon: XCircle,
      colorClass:
        "text-[var(--lg-error-accent)] bg-[var(--lg-error-container)]/10 border-[var(--lg-error-container)]/30",
      glowColor: "var(--lg-accent-red-glow)",
      accentColor: "var(--lg-error-accent)",
    },
    warning: {
      icon: AlertTriangle,
      colorClass:
        "text-[var(--lg-warning-accent)] bg-[var(--lg-warning-accent)]/10 border-[var(--lg-warning-accent)]/30",
      glowColor: "var(--lg-accent-yellow-glow)",
      accentColor: "var(--lg-warning-accent)",
    },
    info: {
      icon: Info,
      colorClass:
        "text-[var(--lg-info-accent)] bg-[var(--lg-info-accent)]/10 border-[var(--lg-info-accent)]/30",
      glowColor: "var(--lg-info-glow)",
      accentColor: "var(--lg-info-accent)",
    },
  }

  const currentConfig = configs[type]
  const Icon = currentConfig.icon

  return (
    <div
      className={`glass-card flex w-full max-w-xl flex-col items-center p-8 text-center md:p-10 ${className}`}
    >
      {/* Flat Clean Status Circle */}
      <div
        className={`mb-6 flex size-12 items-center justify-center rounded-full border text-current ${currentConfig.colorClass}`}
      >
        <Icon className="size-6" />
      </div>

      {/* Title & Description */}
      <h2 className="font-heading text-lg font-bold text-foreground">
        {title}
      </h2>

      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {/* Extra details (clean flat layout) */}
      {extra && (
        <div className="mt-6 w-full rounded-xl border border-border/40 bg-card/15 p-5 text-left backdrop-blur-md">
          {extra}
        </div>
      )}

      {/* Action Buttons */}
      {actions && (
        <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  )
}

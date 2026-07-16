import { AlertCircle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export default function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  return (
    <div
      className="glass-card flex w-full flex-col items-center justify-center border-[var(--lg-error-container)] bg-[var(--lg-surface-glass)] p-6 text-center shadow-lg"
      style={{
        borderColor: "var(--lg-error-container)",
      }}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--lg-error-container)]/20 text-[var(--lg-error-accent)]">
        <AlertCircle className="size-6 animate-pulse" />
      </div>

      <h3 className="font-heading text-base font-bold text-foreground">
        组件加载失败
      </h3>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground">
        此模块运行中发生意外错误。您可以尝试刷新当前组件或联系管理员。
      </p>

      {/* Accordion error details */}
      <details className="mt-4 w-full max-w-xs text-left">
        <summary className="cursor-pointer text-center font-mono text-[10px] text-muted-foreground/80 uppercase hover:text-foreground">
          查看错误日志
        </summary>
        <div className="mt-2 max-h-24 overflow-y-auto rounded border border-border/40 bg-background/50 p-2 font-mono text-[9px] leading-relaxed text-[var(--lg-error-accent)] select-text">
          {error.name}: {error.message}
          {error.stack && (
            <pre className="mt-1 text-[8px] opacity-60">
              {error.stack.split("\n").slice(0, 3).join("\n")}
            </pre>
          )}
        </div>
      </details>

      <Button
        onClick={resetErrorBoundary}
        variant="outline"
        size="sm"
        className="btn-secondary mt-6 gap-2 border-[var(--lg-border)] bg-background/30"
      >
        <RotateCcw className="size-3.5" />
        <span>重新尝试加载</span>
      </Button>
    </div>
  )
}

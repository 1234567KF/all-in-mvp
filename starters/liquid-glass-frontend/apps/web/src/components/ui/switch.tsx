import { Switch as SwitchPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:border-[var(--lg-primary-light)] focus-visible:ring-2 focus-visible:ring-[var(--lg-primary-border)]",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // Unchecked state (glass track)
        "border-[var(--lg-border)] bg-[var(--lg-surface-glass)] backdrop-blur-sm",
        // Checked state (vibrant green track + glow)
        "data-checked:border-[var(--lg-primary-border)] data-checked:bg-[var(--lg-primary)] data-checked:shadow-[0_0_8px_var(--lg-primary-glow)]",
        // Sizes
        "data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform",
          "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          "group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]",
          "group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

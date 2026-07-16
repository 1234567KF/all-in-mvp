import * as React from "react"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  variant = "glass",
  ...props
}: React.ComponentProps<"input"> & {
  variant?: "glass" | "default"
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        variant === "glass" && "glass-input",
        variant === "default" &&
          "border border-input bg-transparent dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }

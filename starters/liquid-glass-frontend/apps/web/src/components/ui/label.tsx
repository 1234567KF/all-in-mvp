import { Label as LabelNS } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

const LabelPrimitive = (
  LabelNS as unknown as {
    Root: React.ForwardRefExoticComponent<
      React.ComponentPropsWithoutRef<"label"> &
        React.RefAttributes<HTMLLabelElement>
    >
  }
).Root

function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    <LabelPrimitive
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }

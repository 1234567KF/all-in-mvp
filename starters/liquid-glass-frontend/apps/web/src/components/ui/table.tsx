import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const check = () => {
      // Use threshold to avoid false positives from sub-pixel rounding
      const scrollable = el.scrollWidth - el.clientWidth > 2
      if (scrollable) {
        el.setAttribute("data-scrollable", "")
      } else {
        el.removeAttribute("data-scrollable")
      }
    }

    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    // Also observe the inner table for content changes
    const table = el.querySelector("table")
    if (table) ro.observe(table)

    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead data-slot="table-header" className={cn("", className)} {...props} />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child_td]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  frozen,
  ...props
}: React.ComponentProps<"th"> & { frozen?: "left" | "right" }) {
  return (
    <th
      data-slot="table-head"
      data-frozen={frozen || undefined}
      className={cn(
        "h-12 border-b border-b-[var(--lg-border-subtle)] px-6 py-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  frozen,
  ...props
}: React.ComponentProps<"td"> & { frozen?: "left" | "right" }) {
  return (
    <td
      data-slot="table-cell"
      data-frozen={frozen || undefined}
      className={cn(
        "border-b border-b-[var(--lg-border-subtle)] px-6 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
}

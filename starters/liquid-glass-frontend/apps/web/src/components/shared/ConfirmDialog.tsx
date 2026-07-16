import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: "default" | "destructive"
  trigger?: React.ReactNode
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  variant = "default",
  trigger,
}: ConfirmDialogProps) {
  // 非控模式：内部管理 open 状态
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  function handleOpenChange(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  function handleConfirm() {
    onConfirm()
    handleOpenChange(false)
  }

  function handleCancel() {
    onCancel?.()
    handleOpenChange(false)
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(variant === "destructive" && "text-destructive")}
          >
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDialog, type ConfirmDialogProps }

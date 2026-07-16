/**
 * DangerZone — 危险操作区域组件
 *
 * 来源：提取自 frontend/src/pages/SystemSettings.tsx L928-1020
 *
 * 结构：红色边框 Card + AlertTriangle 标题 + AlertDialog 二次确认
 * 支持可选密码验证
 */

import { AlertTriangle } from "lucide-react"
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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface DangerZoneProps {
  /** 操作标题（显示在 Card 内 label 位置） */
  title: string
  /** 操作描述（红色警示文字） */
  description: string
  /** 触发按钮文案 */
  buttonText: string
  /** 二次确认弹窗标题（默认："确认{buttonText}？"） */
  confirmTitle?: string
  /** 二次确认弹窗描述（支持 ReactNode，可渲染列表等） */
  confirmDescription?: React.ReactNode
  /** 确认回调（支持同步/异步） */
  onConfirm: () => void | Promise<void>
  /** 是否要求输入密码才能确认（默认 false） */
  requirePassword?: boolean
  /** 自定义 className（加在外层 Card 上） */
  className?: string
}

function DangerZone({
  title,
  description,
  buttonText,
  confirmTitle,
  confirmDescription,
  onConfirm,
  requirePassword = false,
  className,
}: DangerZoneProps) {
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const resolvedConfirmTitle = confirmTitle ?? `确认${buttonText}？`
  const canConfirm = requirePassword ? password.length > 0 : true

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setOpen(false)
      setPassword("")
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (loading) return
    setOpen(nextOpen)
    if (!nextOpen) setPassword("")
  }

  return (
    <>
      <Card
        className={cn("border-destructive/40 bg-destructive/5 py-0", className)}
      >
        <CardHeader className="px-6 pt-6 pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-5 text-destructive" />
            危险操作
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-6">
          <div>
            <div className="mb-1 block text-sm font-medium text-foreground">
              {title}
            </div>
            <p className="mt-1 text-xs text-destructive">{description}</p>
            <Button
              type="button"
              variant="destructive"
              className="mt-3 gap-2 border border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive/30"
              onClick={() => setOpen(true)}
            >
              {buttonText}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              {resolvedConfirmTitle}
            </AlertDialogTitle>
            {confirmDescription && (
              <AlertDialogDescription className="text-left">
                {confirmDescription}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {requirePassword && (
            <div className="px-6">
              <Field>
                <FieldLabel htmlFor="confirm-danger-password">
                  身份验证
                </FieldLabel>
                <Input
                  id="confirm-danger-password"
                  type="password"
                  placeholder="请输入当前用户密码以确认"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canConfirm && !loading) {
                      e.preventDefault()
                      handleConfirm(e as unknown as React.MouseEvent)
                    }
                  }}
                />
              </Field>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!canConfirm || loading}
              onClick={handleConfirm}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <AlertTriangle data-icon="inline-start" />
              )}
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { DangerZone, type DangerZoneProps }

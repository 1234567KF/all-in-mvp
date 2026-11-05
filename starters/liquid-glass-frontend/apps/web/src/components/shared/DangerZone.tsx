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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export interface DangerZoneItemProps {
  id?: string
  /** 操作标题 */
  title: string
  /** 操作描述（警示/策略信息） */
  description: string
  /** 可选状态标签（如 "可清理 0 条"） */
  badgeText?: string
  /** 触发按钮文案 */
  buttonText: string
  /** 二次确认弹窗标题 */
  confirmTitle?: string
  /** 二次确认弹窗描述 */
  confirmDescription?: React.ReactNode
  /**
   * 确认回调。
   * `requirePassword` 为 true 时会把用户输入密码作为首参透传（`onConfirm(password)`），
   * 业务方必须在后端完成真实身份校验——本组件只做前端非空确认门禁，UI 门禁 ≠ 鉴权。
   */
  onConfirm: (password?: string) => void | Promise<void>
  /** 是否要求输入当前用户密码做二次确认（密码仅透传，不在此校验） */
  requirePassword?: boolean
  /** 是否禁用 */
  disabled?: boolean
}

export interface DangerZoneGroupProps {
  /** 危险区域总标题（默认："危险操作"） */
  title?: string
  /** 危险区域总描述 */
  description?: string
  /** 危险操作列表 */
  items: DangerZoneItemProps[]
  /** 自定义 className */
  className?: string
}

/** 危险操作单行组件 */
export function DangerZoneRow({ item }: { item: DangerZoneItemProps }) {
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const resolvedConfirmTitle = item.confirmTitle ?? `确认${item.buttonText}？`
  const canConfirm = item.requirePassword ? password.length > 0 : true

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await item.onConfirm(item.requirePassword ? password : undefined)
      // 成功才关闭弹窗
      setOpen(false)
      setPassword("")
    } catch {
      // 业务方负责错误提示（toast / mutation 默认提示）；这里必须吞掉 rejection，
      // 否则 onClick 返回的 rejected Promise 会触发 UnhandledPromiseRejection。
      // 失败保留弹窗便于重试，同时清空密码避免敏感输入残留。
      setPassword("")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (loading) return
    setOpen(nextOpen)
    if (!nextOpen) setPassword("")
  }

  return (
    <>
      <div className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-1 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {item.title}
            </span>
            {item.badgeText && (
              <Badge
                variant="outline"
                className="border-destructive/30 bg-destructive/10 text-xs text-destructive"
              >
                {item.badgeText}
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--lg-text-secondary)]">
            {item.description}
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={item.disabled}
          className="shrink-0 border border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive hover:text-white"
          onClick={() => setOpen(true)}
        >
          {item.buttonText}
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {resolvedConfirmTitle}
            </AlertDialogTitle>
            {item.confirmDescription && (
              <AlertDialogDescription className="text-left">
                {item.confirmDescription}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {item.requirePassword && (
            <div className="px-6">
              <Field>
                <FieldLabel htmlFor={`confirm-danger-${item.title}`}>
                  身份验证
                </FieldLabel>
                <Input
                  id={`confirm-danger-${item.title}`}
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

/** 危险操作分组卡片：将多项危险操作集中在一个统一卡片中 */
export function DangerZoneGroup({
  title = "危险操作",
  description = "以下包含高风险敏感指令及数据清理操作，请谨慎执行",
  items,
  className,
}: DangerZoneGroupProps) {
  return (
    <Card
      className={cn(
        "glass-card border-destructive/30 bg-destructive/5 py-0",
        className
      )}
    >
      <CardHeader className="px-6 pt-6 pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-5" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-[var(--lg-text-secondary)]">
            {description}
          </p>
        )}
      </CardHeader>
      <CardContent className="divide-y divide-destructive/15 p-6 pt-2">
        {items.map((item, index) => (
          <DangerZoneRow key={item.id ?? item.title ?? index} item={item} />
        ))}
      </CardContent>
    </Card>
  )
}

export interface DangerZoneProps extends DangerZoneItemProps {
  className?: string
}

/** 兼容单项 Card 模式 */
export function DangerZone({ className, ...itemProps }: DangerZoneProps) {
  return (
    <DangerZoneGroup className={className} items={[itemProps]} description="" />
  )
}

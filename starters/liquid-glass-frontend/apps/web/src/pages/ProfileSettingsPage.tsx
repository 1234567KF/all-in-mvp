import { Lock, Moon, Palette, Save, Sun, SunMoon } from "lucide-react"
import { useState } from "react"

import { useTheme } from "@/components/providers/theme-provider"
import { PasswordToggleInput } from "@/components/shared/PasswordToggleInput"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { showError, showSuccess } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { changePassword } from "@/services/auth"
import { useAuthStore } from "@/stores/auth"
import { type LayoutWidth, useLayoutStore } from "@/stores/layoutStore"

export default function ProfileSettingsPage() {
  const { theme, setTheme } = useTheme()
  const { layoutWidth, setLayoutWidth } = useLayoutStore()
  const [changingPassword, setChangingPassword] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleChangePassword = async () => {
    setChangingPassword(true)
    try {
      await changePassword({
        oldPassword,
        newPassword,
      })
      showSuccess("密码修改成功，即将跳转登录页")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => {
        useAuthStore.getState().clearAuth()
        window.location.href = "/login"
      }, 1500)
    } catch (err: unknown) {
      let message = "修改密码失败"
      if (err && typeof err === "object" && "response" in err) {
        const errMsg = (err as { response?: { data?: { message?: string } } })
          .response?.data?.message
        if (errMsg) message = errMsg
      }
      showError(message)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleCancelChangePassword = () => {
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          个人设置
        </h1>
        <p className="mt-2 text-sm text-[var(--lg-text-secondary)]">
          管理你的外观偏好和登录密码
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 外观主题 */}
        <Card className="glass-card py-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="size-5 text-[var(--lg-primary-light)]" />
              外观主题
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-6">
            <div>
              <div className="mb-2 block text-sm font-medium text-foreground">
                选择主题
              </div>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={(value) => {
                  if (value) setTheme(value as "dark" | "light" | "system")
                }}
                className="flex w-full gap-2 sm:gap-3"
              >
                <ToggleGroupItem
                  value="dark"
                  className={cn(
                    "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                    theme === "dark"
                      ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                      : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
                  )}
                >
                  <Moon className="mx-auto mb-1.5 size-6 text-foreground sm:size-8" />
                  <div className="text-xs font-semibold text-foreground sm:text-sm">
                    深色主题
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                    默认
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="light"
                  className={cn(
                    "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                    theme === "light"
                      ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                      : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
                  )}
                >
                  <Sun className="mx-auto mb-1.5 size-6 text-foreground sm:size-8" />
                  <div className="text-xs font-semibold text-foreground sm:text-sm">
                    浅色主题
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                    实验性
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="system"
                  className={cn(
                    "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                    theme === "system"
                      ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                      : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
                  )}
                >
                  <SunMoon className="mx-auto mb-1.5 size-6 text-foreground sm:size-8" />
                  <div className="text-xs font-semibold text-foreground sm:text-sm">
                    跟随系统
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                    自动切换
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator className="bg-[var(--lg-border-subtle)]" />

            <div>
              <div className="mb-2 block text-sm font-medium text-foreground">
                页面布局宽度
              </div>
              <ToggleGroup
                type="single"
                value={layoutWidth}
                onValueChange={(value) => {
                  if (value) setLayoutWidth(value as LayoutWidth)
                }}
                className="flex w-full gap-2 sm:gap-3"
              >
                <ToggleGroupItem
                  value="standard"
                  className={cn(
                    "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                    layoutWidth === "standard"
                      ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                      : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
                  )}
                >
                  <div className="text-xs font-semibold text-foreground sm:text-sm">
                    标准
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                    1280px 居中
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="wide"
                  className={cn(
                    "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                    layoutWidth === "wide"
                      ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                      : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
                  )}
                >
                  <div className="text-xs font-semibold text-foreground sm:text-sm">
                    宽屏
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                    1600px (默认)
                  </div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="fluid"
                  className={cn(
                    "h-auto flex-1 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border bg-[var(--lg-surface-glass)] px-1 py-3 text-center transition-all sm:p-4",
                    layoutWidth === "fluid"
                      ? "border-[var(--lg-primary-light)] bg-accent/20 shadow-[0_0_12px_var(--lg-primary-glow)]"
                      : "border-[var(--lg-border)] hover:border-[var(--lg-primary-light)]/40"
                  )}
                >
                  <div className="text-xs font-semibold text-foreground sm:text-sm">
                    撑满
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal whitespace-nowrap text-[var(--lg-text-secondary)] sm:text-xs">
                    100% 宽度
                  </div>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator className="bg-[var(--lg-border-subtle)]" />

            <div>
              <div className="mb-1 block text-sm font-medium text-foreground">
                偏好设置
              </div>
              <p className="text-xs text-[var(--lg-text-secondary)]">
                外观与布局偏好将保存在浏览器本地，下次访问时自动应用
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 修改登录密码 */}
        <Card className="glass-card py-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-5 text-[var(--lg-primary-light)]" />
              修改登录密码
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-6">
            <FieldGroup>
              {/* 旧密码 */}
              <Field>
                <FieldLabel htmlFor="oldPassword">旧密码</FieldLabel>
                <PasswordToggleInput
                  id="oldPassword"
                  name="oldPassword"
                  placeholder="请输入当前密码"
                  value={oldPassword}
                  onChange={setOldPassword}
                  className="[&_input]:h-10 [&_input]:font-mono"
                />
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              {/* 新密码 */}
              <Field
                data-invalid={
                  newPassword &&
                  (newPassword.length < 6 || newPassword.length > 128)
                    ? "true"
                    : undefined
                }
              >
                <FieldLabel htmlFor="newPassword">新密码</FieldLabel>
                <PasswordToggleInput
                  id="newPassword"
                  name="newPassword"
                  placeholder="请输入新密码（6-128 字符）"
                  value={newPassword}
                  onChange={setNewPassword}
                  error={
                    newPassword &&
                    (newPassword.length < 6 || newPassword.length > 128)
                      ? "true"
                      : undefined
                  }
                  className="[&_input]:h-10 [&_input]:font-mono"
                />
                {newPassword &&
                  (newPassword.length < 6 || newPassword.length > 128) && (
                    <FieldError>新密码长度需在 6-128 字符之间</FieldError>
                  )}
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              {/* 确认新密码 */}
              <Field
                data-invalid={
                  confirmPassword && newPassword !== confirmPassword
                    ? "true"
                    : undefined
                }
              >
                <FieldLabel htmlFor="confirmPassword">确认新密码</FieldLabel>
                <PasswordToggleInput
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="请再次输入新密码"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  error={
                    confirmPassword && newPassword !== confirmPassword
                      ? "true"
                      : undefined
                  }
                  className="[&_input]:h-10 [&_input]:font-mono"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <FieldError>两次密码不一致</FieldError>
                )}
              </Field>
            </FieldGroup>

            <Separator className="bg-[var(--lg-border-subtle)]" />

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  changingPassword ||
                  !oldPassword ||
                  !newPassword ||
                  newPassword.length < 6 ||
                  newPassword.length > 128 ||
                  newPassword !== confirmPassword
                }
                onClick={handleChangePassword}
              >
                {changingPassword ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save data-icon="inline-start" />
                    保存
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={changingPassword}
                onClick={handleCancelChangePassword}
              >
                取消
              </Button>
            </div>
            <p className="text-xs text-[var(--lg-text-secondary)]">
              修改密码后，所有设备将被强制登出，请使用新密码重新登录
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

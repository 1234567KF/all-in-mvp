import { Lock, Save, User } from "lucide-react"
import { useState } from "react"
import { PERMISSIONS } from "shared"

import { PasswordToggleInput } from "@/components/shared/PasswordToggleInput"
import { PermissionGate } from "@/components/shared/PermissionGate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { useCurrentUser, useUpdateCurrentUser } from "@/hooks/queries/useUsers"
import { extractErrorMessage } from "@/lib/errors"
import { showError, showSuccess } from "@/lib/toast"
import { AppearanceSettingsCard } from "@/pages/profile-settings/components/AppearanceSettingsCard"
import { changePassword } from "@/services/auth"
import { useAuthStore } from "@/stores/auth"

export default function ProfileSettingsPage() {
  const [changingPassword, setChangingPassword] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // ─── 个人资料（TanStack Query 活教材：页面 → hook → service → API）───────
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const updateCurrentUser = useUpdateCurrentUser()
  // “脏标记”模式：未编辑时展示服务端值，编辑后跟踪本地值，避免 useEffect 同步
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const displayName = nameDraft ?? currentUser?.name ?? ""

  const handleSaveProfile = () => {
    updateCurrentUser.mutate(
      { name: displayName },
      {
        onSuccess: () => {
          showSuccess("个人资料已更新")
          setNameDraft(null) // 重置脏标记，后续展示服务端新值
        },
        // 失败提示由 lib/query.ts 的全局 mutation onError 兜底（文案优先服务端 message），
        // 此处不要重复 onError toast，否则同一错误会弹两次
      }
    )
  }

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
    } catch (err) {
      // 统一走 lib/errors：优先服务端 message，网络/超时等 axios 英文原生文案转中文
      showError(extractErrorMessage(err))
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
          管理你的个人资料、外观偏好和登录密码
        </p>
      </div>

      {/* 个人资料 — TanStack Query 端到端示例（useCurrentUser / useUpdateCurrentUser） */}
      <Card className="glass-card py-0">
        <CardHeader className="px-6 pt-6 pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-5 text-[var(--lg-primary-light)]" />
            个人资料
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-6">
          {userLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--lg-text-secondary)]">
              <Spinner data-icon="inline-start" />
              加载中...
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <FieldLabel htmlFor="displayName">显示名称</FieldLabel>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="请输入显示名称"
                  className="h-10"
                />
              </div>
              <div className="flex-1">
                <FieldLabel>邮箱</FieldLabel>
                <Input
                  value={currentUser?.email ?? ""}
                  disabled
                  className="h-10 opacity-60"
                />
              </div>
              {/* PUT /users/me 由后端 requirePermission(USER_EDIT) 把关，按钮按同权限显隐 */}
              <PermissionGate
                perm={PERMISSIONS.USER_EDIT}
                fallback={
                  <span className="pb-2.5 text-xs text-[var(--lg-text-muted)]">
                    无编辑权限
                  </span>
                }
              >
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    updateCurrentUser.isPending ||
                    !displayName.trim() ||
                    displayName === currentUser?.name
                  }
                  onClick={handleSaveProfile}
                >
                  {updateCurrentUser.isPending ? (
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
              </PermissionGate>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AppearanceSettingsCard />
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
              修改成功后该账号所有会话（含当前）的续期凭证（refreshToken）即刻作废，需重新登录；
              已签发的 accessToken 无状态，最长在 1 小时有效期内自然失效
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

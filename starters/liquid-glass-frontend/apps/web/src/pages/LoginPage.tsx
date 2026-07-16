import { AlertCircle, Shield } from "lucide-react"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { PasswordToggleInput } from "@/components/shared/PasswordToggleInput"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { login } from "@/services/auth"
import { useAuthStore } from "@/stores/auth"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || "/dashboard"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError("请填写所有字段")
      return
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位")
      return
    }
    setLoading(true)
    try {
      const res = await login({ email, password })
      setAuth({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      })
      navigate(from, { viewTransition: true })
    } catch (err: unknown) {
      const apiErr = err as {
        response?: {
          status?: number
          data?: { success?: boolean; code?: string; message?: string }
        }
        message?: string
      }

      if (apiErr?.response?.data?.message) {
        setError(apiErr.response.data.message)
      } else if (apiErr?.message === "Network Error" || !apiErr?.response) {
        setError("网络连接失败，请检查网络后重试")
      } else {
        setError("登录失败，请稍后重试")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative mx-auto flex max-w-[480px] items-center justify-center"
      style={{ minHeight: "calc(100vh - var(--topbar-height) - 64px)" }}
    >
      {/* Background Blobs — positioned within viewport, not clipped */}
      <div
        className="animate-blob absolute top-[5%] left-[-8%] h-[40%] w-[45%] rounded-full blur-[120px]"
        style={{ background: "var(--lg-primary-dim)" }}
      />
      <div
        className="animate-blob animation-delay-2000 absolute top-[15%] right-[-5%] h-[35%] w-[38%] rounded-full blur-[100px]"
        style={{ background: "var(--lg-secondary-dim)" }}
      />
      <div
        className="animate-blob animation-delay-4000 absolute bottom-[5%] left-[8%] h-[30%] w-[32%] rounded-full blur-[110px]"
        style={{ background: "var(--lg-tertiary-dim)" }}
      />

      {/* Card */}
      <div
        className="glass-card relative w-full overflow-hidden py-0"
        style={{ borderRadius: "var(--radius-glass-lg)" }}
      >
        {/* Glass Highlight */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />

        {/* Brand */}
        <div className="relative flex flex-col items-center px-6 pt-12 pb-0 sm:px-12">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-primary bg-[var(--lg-primary-dim)]">
            <Shield className="size-6 text-primary-accent" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Liquid Glass
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">组织管理员登录</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="relative flex flex-col gap-4 px-6 pt-8 sm:px-12"
        >
          <Field>
            <FieldLabel
              htmlFor="email"
              className="form-label text-xs tracking-wider text-muted-foreground/70 uppercase"
            >
              账号
            </FieldLabel>
            <Input
              id="email"
              type="text"
              className="h-10 border-input bg-background/40 backdrop-blur-[12px] placeholder:text-muted-foreground/30 focus:border-primary/50"
              placeholder="请输入账号"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel
              htmlFor="password"
              className="form-label text-xs tracking-wider text-muted-foreground/70 uppercase"
            >
              密码
            </FieldLabel>
            <PasswordToggleInput
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="请输入密码"
              className="bg-background/40 backdrop-blur-[12px] [&_input]:h-10 [&_input]:border-input [&_input]:bg-background/40 [&_input]:backdrop-blur-[12px] [&_input]:placeholder:text-muted-foreground/30 [&_input]:focus:border-primary/50"
            />
          </Field>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="mt-4 w-full justify-center"
            style={{ height: 44 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                验证中...
              </>
            ) : (
              "进入系统"
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="relative mt-6 border-t border-[var(--lg-border-subtle)] px-6 pt-6 pb-8 text-center sm:px-12">
          <p className="text-[11px] text-muted-foreground/60">
            默认账号：admin / 密码：任意 6 位以上
          </p>
          <p className="mt-2 text-[11px] text-outline">
            仅受信任的组织管理员可访问此平台
            <br />© 2026 Liquid Glass Demo
          </p>
        </div>
      </div>
    </div>
  )
}

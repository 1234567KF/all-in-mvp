import {
  Bell,
  Database,
  Info,
  RotateCcw,
  Save,
  Settings,
  Shield,
} from "lucide-react"
import { useState } from "react"

import {
  DangerZoneGroup,
  type DangerZoneItemProps,
} from "@/components/shared/DangerZone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { showInfo, showSuccess } from "@/lib/toast"

// 默认值集中管理，便于「恢复默认设置」重置
const DEFAULTS = {
  appName: "Liquid Glass App",
  language: "zh-CN",
  timezone: "Asia/Shanghai",
  dateFormat: "YYYY-MM-DD",
  pageSize: "20",
  browserPush: "enabled",
  emailDigest: "daily",
  systemAnnounce: "enabled",
  quietStart: "22:00",
  quietEnd: "08:00",
  minPasswordLen: "6",
  passwordExpireDays: "0",
  accessTokenExpiry: "2h",
  refreshTokenExpiry: "7d",
  sessionTimeout: "1h",
  loginLock: "5",
  lockDuration: "30",
  passwordPolicy: "standard",
  logRetention: "90",
} as const

export default function SystemSettingsPage() {
  // 通用设置状态
  const [appName, setAppName] = useState<string>(DEFAULTS.appName)
  const [language, setLanguage] = useState<string>(DEFAULTS.language)
  const [timezone, setTimezone] = useState<string>(DEFAULTS.timezone)
  const [dateFormat, setDateFormat] = useState<string>(DEFAULTS.dateFormat)
  const [pageSize, setPageSize] = useState<string>(DEFAULTS.pageSize)

  // 通知设置状态
  const [browserPush, setBrowserPush] = useState<string>(DEFAULTS.browserPush)
  const [emailDigest, setEmailDigest] = useState<string>(DEFAULTS.emailDigest)
  const [systemAnnounce, setSystemAnnounce] = useState<string>(
    DEFAULTS.systemAnnounce
  )
  const [quietStart, setQuietStart] = useState<string>(DEFAULTS.quietStart)
  const [quietEnd, setQuietEnd] = useState<string>(DEFAULTS.quietEnd)

  // 安全与令牌配置
  const [minPasswordLen, setMinPasswordLen] = useState<string>(
    DEFAULTS.minPasswordLen
  )
  const [passwordExpireDays, setPasswordExpireDays] = useState<string>(
    DEFAULTS.passwordExpireDays
  )
  const [accessTokenExpiry, setAccessTokenExpiry] = useState<string>(
    DEFAULTS.accessTokenExpiry
  )
  const [refreshTokenExpiry, setRefreshTokenExpiry] = useState<string>(
    DEFAULTS.refreshTokenExpiry
  )
  const [sessionTimeout, setSessionTimeout] = useState<string>(
    DEFAULTS.sessionTimeout
  )
  const [loginLock, setLoginLock] = useState<string>(DEFAULTS.loginLock)
  const [lockDuration, setLockDuration] = useState<string>(
    DEFAULTS.lockDuration
  )
  const [passwordPolicy, setPasswordPolicy] = useState<string>(
    DEFAULTS.passwordPolicy
  )
  const [logRetention, setLogRetention] = useState<string>(
    DEFAULTS.logRetention
  )

  // 备份状态
  const [lastBackupTime, setLastBackupTime] = useState<string>("从未备份")
  const [backupSize, setBackupSize] = useState<string>("0 MB")
  const [backingUp, setBackingUp] = useState<boolean>(false)

  // 保存中状态（模拟短暂 loading）
  const [saving, setSaving] = useState<string | null>(null)

  const handleSave = (tab: string, message: string) => {
    setSaving(tab)
    setTimeout(() => {
      setSaving(null)
      showSuccess(message)
    }, 500)
  }

  // 纯前端模拟：真实备份需经 services/ 调用后端，此处数据仅供演示
  const handleImmediateBackup = () => {
    setBackingUp(true)
    setTimeout(() => {
      setBackingUp(false)
      const now = new Date().toLocaleString()
      setLastBackupTime(now)
      setBackupSize("14.8 MB (Demo)")
      showSuccess("数据库备份成功 (Demo)")
    }, 1200)
  }

  const resetAll = () => {
    setAppName(DEFAULTS.appName)
    setLanguage(DEFAULTS.language)
    setTimezone(DEFAULTS.timezone)
    setDateFormat(DEFAULTS.dateFormat)
    setPageSize(DEFAULTS.pageSize)
    setBrowserPush(DEFAULTS.browserPush)
    setEmailDigest(DEFAULTS.emailDigest)
    setSystemAnnounce(DEFAULTS.systemAnnounce)
    setQuietStart(DEFAULTS.quietStart)
    setQuietEnd(DEFAULTS.quietEnd)
    setMinPasswordLen(DEFAULTS.minPasswordLen)
    setPasswordExpireDays(DEFAULTS.passwordExpireDays)
    setAccessTokenExpiry(DEFAULTS.accessTokenExpiry)
    setRefreshTokenExpiry(DEFAULTS.refreshTokenExpiry)
    setSessionTimeout(DEFAULTS.sessionTimeout)
    setLoginLock(DEFAULTS.loginLock)
    setLockDuration(DEFAULTS.lockDuration)
    setPasswordPolicy(DEFAULTS.passwordPolicy)
    setLogRetention(DEFAULTS.logRetention)
  }

  const passwordPolicyBadge: Record<
    string,
    { label: string; variant: "warning" | "info" | "success" }
  > = {
    loose: { label: "宽松", variant: "warning" },
    standard: { label: "标准", variant: "info" },
    strict: { label: "严格", variant: "success" },
  }

  // 危险操作集合
  const dangerItems: DangerZoneItemProps[] = [
    {
      id: "clean-audit-log",
      title: "审计日志清理",
      description: "当前策略：保留 180 天，可清理 0 条过期日志",
      badgeText: "可清理 0 条",
      buttonText: "执行清理",
      onConfirm: async () => {
        showInfo("暂无可清理的审计日志")
      },
    },
    {
      id: "clean-orphan-attachments",
      title: "孤立附件清理",
      description: "未绑定任何业务实体且创建超过 7 天的离散附件",
      badgeText: "可清理 0 个",
      buttonText: "执行清理",
      onConfirm: async () => {
        showInfo("暂无可清理的孤立附件")
      },
    },
    {
      id: "clean-expired-sessions",
      title: "过期会话清理",
      description: "当前策略：已撤销且过期超过 30 天的无效会话令牌",
      badgeText: "可清理 0 条",
      buttonText: "执行清理",
      onConfirm: async () => {
        showInfo("已成功清理过期会话")
      },
    },
    {
      id: "clean-read-notifications",
      title: "已读通知清理",
      description: "当前策略：已被用户读取且发布超过 90 天的历史通知",
      badgeText: "可清理 0 条",
      buttonText: "执行清理",
      onConfirm: async () => {
        showInfo("已清理旧的已读通知")
      },
    },
    {
      id: "clean-app-cache",
      title: "清空应用缓存",
      description: "将清除浏览器中所有本地缓存数据，不影响账户状态",
      buttonText: "清空缓存",
      onConfirm: async () => {
        const keys = Object.keys(localStorage).filter(
          (k) => !k.startsWith("auth-storage")
        )
        keys.forEach((k) => localStorage.removeItem(k))
        showSuccess("缓存已清空，刷新页面后生效")
      },
    },
    {
      id: "reset-defaults",
      title: "恢复默认设置",
      description: "将所有系统配置参数重置为出厂初始状态，此操作不可逆",
      buttonText: "恢复默认",
      requirePassword: true,
      onConfirm: async () => {
        resetAll()
        showSuccess("已成功恢复默认设置")
      },
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* 标题区 */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          系统设置
        </h1>
        <p className="mt-2 text-sm text-[var(--lg-text-secondary)]">
          管理应用全局配置、安全规则、数据备份与维护指令
        </p>
      </div>

      {/* 双栏网格卡片排列 */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* 左侧列：通用设置 & 安全配置 */}
        <div className="flex flex-col gap-6">
          {/* 通用设置 */}
          <Card className="glass-card py-0">
            <CardHeader className="px-6 pt-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="size-5 text-[var(--lg-primary-light)]" />
                通用设置
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <Field>
                <FieldLabel htmlFor="appName">应用名称</FieldLabel>
                <Input
                  id="appName"
                  placeholder="Liquid Glass App"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                />
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>默认语言</FieldLabel>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>时区</FieldLabel>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Shanghai">
                      Asia/Shanghai (UTC+8)
                    </SelectItem>
                    <SelectItem value="Europe/London">
                      Europe/London (UTC+0)
                    </SelectItem>
                    <SelectItem value="America/New_York">
                      America/New_York (UTC-5)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>日期格式</FieldLabel>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>默认分页条数</FieldLabel>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 条/页</SelectItem>
                    <SelectItem value="20">20 条/页</SelectItem>
                    <SelectItem value="50">50 条/页</SelectItem>
                    <SelectItem value="100">100 条/页</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving === "general"}
                  onClick={() => handleSave("general", "通用设置已保存")}
                >
                  <Save data-icon="inline-start" />
                  {saving === "general" ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" size="sm">
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 安全设置 */}
          <Card className="glass-card py-0">
            <CardHeader className="px-6 pt-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-5 text-[var(--lg-primary-light)]" />
                安全与密码策略
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <Field>
                <FieldLabel htmlFor="minPasswordLen">密码最小长度</FieldLabel>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="减小密码最小长度"
                    className="size-9 p-0"
                    onClick={() =>
                      setMinPasswordLen(
                        Math.max(
                          6,
                          parseInt(minPasswordLen || "6") - 1
                        ).toString()
                      )
                    }
                  >
                    -
                  </Button>
                  <Input
                    id="minPasswordLen"
                    type="number"
                    min={6}
                    max={32}
                    value={minPasswordLen}
                    onChange={(e) => setMinPasswordLen(e.target.value)}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="增大密码最小长度"
                    className="size-9 p-0"
                    onClick={() =>
                      setMinPasswordLen(
                        (parseInt(minPasswordLen || "6") + 1).toString()
                      )
                    }
                  >
                    +
                  </Button>
                </div>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel htmlFor="passwordExpireDays">
                  强制修改周期
                </FieldLabel>
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="减少强制修改周期 30 天"
                      className="size-9 shrink-0 p-0"
                      onClick={() =>
                        setPasswordExpireDays(
                          Math.max(
                            0,
                            parseInt(passwordExpireDays || "0") - 30
                          ).toString()
                        )
                      }
                    >
                      -
                    </Button>
                    <Input
                      id="passwordExpireDays"
                      type="number"
                      min={0}
                      value={passwordExpireDays}
                      onChange={(e) => setPasswordExpireDays(e.target.value)}
                      className="text-center"
                    />
                    <span className="shrink-0 text-sm text-[var(--lg-text-secondary)]">
                      天
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="增加强制修改周期 30 天"
                      className="size-9 shrink-0 p-0"
                      onClick={() =>
                        setPasswordExpireDays(
                          (parseInt(passwordExpireDays || "0") + 30).toString()
                        )
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-[var(--lg-text-secondary)]">
                  设为 0 表示不强制定期修改密码
                </p>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>Access Token 有效期</FieldLabel>
                <Select
                  value={accessTokenExpiry}
                  onValueChange={setAccessTokenExpiry}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15m">15 分钟</SelectItem>
                    <SelectItem value="1h">1 小时</SelectItem>
                    <SelectItem value="2h">2 小时</SelectItem>
                    <SelectItem value="1d">24 小时</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-[var(--lg-text-secondary)]">
                  用户登录后的访问令牌有效时长
                </p>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>Refresh Token 有效期</FieldLabel>
                <Select
                  value={refreshTokenExpiry}
                  onValueChange={setRefreshTokenExpiry}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">1 天</SelectItem>
                    <SelectItem value="7d">7 天</SelectItem>
                    <SelectItem value="14d">14 天</SelectItem>
                    <SelectItem value="30d">30 天</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-[var(--lg-text-secondary)]">
                  刷新令牌有效期，过期后需重新登录
                </p>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>会话超时自动注销</FieldLabel>
                <Select
                  value={sessionTimeout}
                  onValueChange={setSessionTimeout}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30m">30 分钟无操作</SelectItem>
                    <SelectItem value="1h">1 小时无操作</SelectItem>
                    <SelectItem value="4h">4 小时无操作</SelectItem>
                    <SelectItem value="never">永不超时</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>登录失败锁定</FieldLabel>
                <div className="flex items-center gap-3">
                  <Select value={loginLock} onValueChange={setLoginLock}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 次后锁定</SelectItem>
                      <SelectItem value="5">5 次后锁定</SelectItem>
                      <SelectItem value="10">10 次后锁定</SelectItem>
                      <SelectItem value="never">不锁定</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex shrink-0 items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      aria-label="锁定时长（分钟）"
                      value={lockDuration}
                      onChange={(e) => setLockDuration(e.target.value)}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-[var(--lg-text-secondary)]">
                      分钟
                    </span>
                  </div>
                </div>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>密码强度策略</FieldLabel>
                <div className="flex items-center gap-3">
                  <Select
                    value={passwordPolicy}
                    onValueChange={setPasswordPolicy}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loose">宽松</SelectItem>
                      <SelectItem value="standard">标准</SelectItem>
                      <SelectItem value="strict">严格</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge
                    variant={passwordPolicyBadge[passwordPolicy].variant}
                    className="shrink-0"
                  >
                    {passwordPolicyBadge[passwordPolicy].label}
                  </Badge>
                </div>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>操作日志保留</FieldLabel>
                <Select value={logRetention} onValueChange={setLogRetention}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                    <SelectItem value="180">180 天</SelectItem>
                    <SelectItem value="forever">永久</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving === "security"}
                  onClick={() => handleSave("security", "安全设置已保存")}
                >
                  <Save data-icon="inline-start" />
                  {saving === "security" ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" size="sm">
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧列：通知设置、存储维护 & 危险操作组 */}
        <div className="flex flex-col gap-6">
          {/* 通知设置 */}
          <Card className="glass-card py-0">
            <CardHeader className="px-6 pt-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-5 text-[var(--lg-primary-light)]" />
                通知设置
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <Field
                orientation="horizontal"
                className="items-center justify-between"
              >
                <div className="flex flex-1 flex-col gap-1.5 pr-4">
                  <FieldLabel htmlFor="browserPush" className="mb-0">
                    浏览器推送通知
                  </FieldLabel>
                  <p className="text-xs text-[var(--lg-text-secondary)]">
                    允许应用在桌面端发送即时系统通知
                  </p>
                </div>
                <Switch
                  id="browserPush"
                  checked={browserPush === "enabled"}
                  onCheckedChange={(checked) =>
                    setBrowserPush(checked ? "enabled" : "disabled")
                  }
                />
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>邮件摘要频率</FieldLabel>
                <Select value={emailDigest} onValueChange={setEmailDigest}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">实时</SelectItem>
                    <SelectItem value="daily">每日</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="off">关闭</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field
                orientation="horizontal"
                className="items-center justify-between"
              >
                <div className="flex flex-1 flex-col gap-1.5 pr-4">
                  <FieldLabel htmlFor="systemAnnounce" className="mb-0">
                    系统公告通知
                  </FieldLabel>
                  <p className="text-xs text-[var(--lg-text-secondary)]">
                    允许应用在界面上方及横幅展示管理员系统公告
                  </p>
                </div>
                <Switch
                  id="systemAnnounce"
                  checked={systemAnnounce === "enabled"}
                  onCheckedChange={(checked) =>
                    setSystemAnnounce(checked ? "enabled" : "disabled")
                  }
                />
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <Field>
                <FieldLabel>静音时段</FieldLabel>
                <div className="flex items-center gap-3">
                  <Input
                    type="time"
                    aria-label="静音开始时间"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="w-auto"
                  />
                  <span className="text-sm text-[var(--lg-text-secondary)]">
                    至
                  </span>
                  <Input
                    type="time"
                    aria-label="静音结束时间"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </Field>

              <Separator className="bg-[var(--lg-border-subtle)]" />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving === "notifications"}
                  onClick={() => handleSave("notifications", "通知设置已保存")}
                >
                  <Save data-icon="inline-start" />
                  {saving === "notifications" ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" size="sm">
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 数据备份 */}
          <Card className="glass-card py-0">
            <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-5 text-[var(--lg-primary-light)]" />
                数据备份
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={backingUp}
                onClick={handleImmediateBackup}
              >
                <RotateCcw
                  className={`size-3.5 ${backingUp ? "animate-spin" : ""}`}
                  data-icon="inline-start"
                />
                {backingUp ? "备份中..." : "立即备份"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <p className="text-xs text-[var(--lg-text-secondary)]">
                每日 03:00 自动备份，保留最近 30 份全量快照
              </p>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--lg-border-subtle)] bg-muted/20 p-3.5">
                <div>
                  <span className="block text-xs text-[var(--lg-text-secondary)]">
                    上次备份
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-foreground">
                    {lastBackupTime}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-[var(--lg-text-secondary)]">
                    备份状态
                  </span>
                  <Badge variant="outline" className="mt-0.5 text-xs">
                    {lastBackupTime === "从未备份" ? "无" : "正常"}
                  </Badge>
                </div>
                <div>
                  <span className="block text-xs text-[var(--lg-text-secondary)]">
                    备份大小
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-foreground">
                    {backupSize}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-[var(--lg-text-secondary)]">
                    保留 / 存储
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-foreground">
                    30 份 · 本地
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 系统信息 */}
          <Card className="glass-card py-0">
            <CardHeader className="px-6 pt-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-5 text-[var(--lg-primary-light)]" />
                系统信息
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--lg-text-secondary)]">
                    API 端点
                  </span>
                  <code className="font-mono text-xs text-foreground">
                    {import.meta.env.VITE_API_BASE_URL || "/api/v1"}
                  </code>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--lg-text-secondary)]">
                    运行环境
                  </span>
                  <Badge variant="outline">
                    {import.meta.env.MODE || "development"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--lg-text-secondary)]">
                    应用版本
                  </span>
                  <Badge>v1.0.0</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--lg-text-secondary)]">
                    构建时间
                  </span>
                  <span className="text-sm text-foreground">
                    {import.meta.env.VITE_BUILD_TIME ?? "未注入"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 危险操作（统一分组卡片，不再平铺竖排多个卡片） */}
          <DangerZoneGroup items={dangerItems} />
        </div>
      </div>
    </div>
  )
}

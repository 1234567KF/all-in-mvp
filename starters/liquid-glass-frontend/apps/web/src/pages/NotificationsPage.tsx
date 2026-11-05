import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Inbox,
  RefreshCw,
  RotateCcw,
} from "lucide-react"
import { useMemo, useState } from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import type { NotificationItem } from "@/components/shared/notification-config"
import { NotificationBell } from "@/components/shared/NotificationBell"
import { NotificationCenter } from "@/components/shared/NotificationCenter"
import { NotificationPanel } from "@/components/shared/NotificationPanel"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useDemoNotifications } from "@/hooks/useDemoNotifications"
import {
  DEMO_NOTIFICATION_EMPHASIS,
  DEMO_NOTIFICATION_TYPES,
  DEMO_NOTIFICATIONS,
} from "@/lib/demo-notifications"
import { showInfo } from "@/lib/toast"
import { CodeLabel, Section } from "@/pages/sections/shared"

const CUSTOM_CONTENT_NOTIFICATION: NotificationItem = {
  id: "custom-render",
  type: "announcement",
  title: "自定义正文渲染",
  content: "renderContent 接管后可以插入任意 React 节点，例如状态图标",
  read: false,
  createdAt: new Date().toISOString(),
}

const BUSINESS_REGISTRY_SNIPPET = `const crmTypes = {
  review_submitted: { icon: ClipboardCheck, tone: "primary" },
  review_approved: { icon: CheckCircle2, tone: "success" },
  review_rejected: { icon: XCircle, tone: "danger" },
}

<NotificationCenter
  notifications={notifications}
  unreadCount={unreadCount}
  typeRegistry={crmTypes}
  emphasis={[{ words: ["请及时审核", "待审核"], tone: "primary" }]}
  onItemClick={(item) => navigate(getNotificationRoute(item))}
/>`

const QUERY_ADAPTER_SNIPPET = `// 真实业务：服务端数据走 TanStack Query hooks
const { data = [], isLoading, error } = useQuery(notificationKeys.list())
const notifications = data.map(toNotificationItem) // wire → view model（read/createdAt/href）

<NotificationCenter
  notifications={notifications}
  loading={isLoading}
  error={error instanceof Error ? error.message : null}
  onMarkRead={(item) => markRead(item.id)}
  onMarkAllRead={markAllRead}
  onDelete={(item) => remove(item.id)}
  onItemClick={(item) => item.href && navigate(item.href)}
/>`

export default function NotificationsPage() {
  const centerDemo = useDemoNotifications()
  const panelDemo = useDemoNotifications()
  const [bellCount, setBellCount] = useState(3)

  const longNotifications = useMemo<NotificationItem[]>(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const base = DEMO_NOTIFICATIONS[index % DEMO_NOTIFICATIONS.length]
        return {
          ...base,
          id: `${base.id}-long-${index}`,
          title: `${base.title} #${index + 1}`,
          read: index % 3 !== 0,
        }
      }),
    []
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="消息通知"
        description="业务无关的消息中心：Bell / NotificationPanel / NotificationCenter"
      />

      {/* =================== NotificationCenter =================== */}
      <Section title="NotificationCenter（顶栏铃铛）">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Popover + Bell + Panel</CardTitle>
            <CardDescription>
              业务只负责注入数据和回调；组件管理开合与点击后关闭。本页使用独立演示数据，真实项目应让顶栏与页面共享同一
              query cache / SSE 状态。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-container)] px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: "var(--lg-text-secondary)" }}>
                  模拟顶栏
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "var(--lg-primary-dim)",
                    color: "var(--lg-primary-text)",
                  }}
                >
                  未读 {centerDemo.unreadCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <NotificationCenter
                  notifications={centerDemo.notifications}
                  unreadCount={centerDemo.unreadCount}
                  typeRegistry={DEMO_NOTIFICATION_TYPES}
                  emphasis={DEMO_NOTIFICATION_EMPHASIS}
                  onMarkRead={(notification) =>
                    centerDemo.markRead(notification.id)
                  }
                  onMarkAllRead={centerDemo.markAllRead}
                  onDelete={(notification) =>
                    centerDemo.remove(notification.id)
                  }
                  onItemClick={(notification) => {
                    showInfo(
                      notification.href
                        ? `演示跳转：${notification.href}`
                        : "该消息没有关联页面"
                    )
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={centerDemo.reset}
                  className="text-xs text-[var(--lg-text-secondary)]"
                >
                  <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
                  重置数据
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-8">
              {[0, 3, 128].map((count) => (
                <div key={count} className="flex flex-col items-center gap-2">
                  <NotificationBell unreadCount={count} />
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--lg-text-muted)" }}
                  >
                    unreadCount={count}
                  </span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <NotificationBell unreadCount={bellCount} />
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setBellCount((count) => (count + 1) % 4)}
                >
                  切换 {bellCount}
                </Button>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant">
              角标超过 99 显示 <CodeLabel text="99+" />
              ；未读角标、未读点、类型图标颜色都跟随
              <CodeLabel text="typeRegistry" /> 的 tone。
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* =================== Panel 状态 =================== */}
      <Section title="NotificationPanel 状态矩阵">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">可交互列表</CardTitle>
              <CardDescription>
                未读 / 已读、实体 chip、动作词高亮、hover 操作。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationPanel
                className="w-full"
                notifications={panelDemo.notifications}
                unreadCount={panelDemo.unreadCount}
                typeRegistry={DEMO_NOTIFICATION_TYPES}
                emphasis={DEMO_NOTIFICATION_EMPHASIS}
                onMarkRead={(notification) =>
                  panelDemo.markRead(notification.id)
                }
                onMarkAllRead={panelDemo.markAllRead}
                onDelete={(notification) => panelDemo.remove(notification.id)}
                onItemClick={(notification) =>
                  showInfo(`打开消息：${notification.title}`)
                }
                footer={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => showInfo("演示：打开全部消息页")}
                  >
                    查看全部消息
                  </Button>
                }
              />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">加载 / 空 / 错误</CardTitle>
              <CardDescription>
                列表为空时才展示状态视图；已有数据时不会因 loading 清空。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <NotificationPanel
                className="w-full"
                notifications={[]}
                loading
              />
              <NotificationPanel className="w-full" notifications={[]} />
              <NotificationPanel
                className="w-full"
                notifications={[]}
                error="消息加载失败，请稍后重试"
                onRetry={() => showInfo("已触发重试（演示）")}
              />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">只读模式</CardTitle>
              <CardDescription>
                不传任何回调时整行不可点击，也不渲染操作按钮。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationPanel
                className="w-full"
                notifications={DEMO_NOTIFICATIONS.slice(0, 3)}
                typeRegistry={DEMO_NOTIFICATION_TYPES}
                emphasis={DEMO_NOTIFICATION_EMPHASIS}
              />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">长列表滚动</CardTitle>
              <CardDescription>
                <CodeLabel text="maxHeight" /> 控制列表高度，内容在内部滚动。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationPanel
                className="w-full"
                notifications={longNotifications}
                maxHeight={260}
                typeRegistry={DEMO_NOTIFICATION_TYPES}
                emphasis={DEMO_NOTIFICATION_EMPHASIS}
                onItemClick={(notification) =>
                  showInfo(`打开消息：${notification.title}`)
                }
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* =================== 业务扩展 =================== */}
      <Section title="业务扩展点">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">
                类型 / 文案 / 跳转注入
              </CardTitle>
              <CardDescription>
                组件默认只有通用语义类型；业务域映射全部通过 props 注入。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.keys(DEMO_NOTIFICATION_TYPES).map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-container)] px-2 py-1 font-mono"
                    style={{ color: "var(--lg-text-secondary)" }}
                  >
                    {type}
                  </span>
                ))}
              </div>
              <pre className="overflow-x-auto rounded-lg border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-container)] p-3 font-mono text-[11px] leading-relaxed text-[var(--lg-text-secondary)]">
                <code>{BUSINESS_REGISTRY_SNIPPET}</code>
              </pre>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">自定义正文渲染</CardTitle>
              <CardDescription>
                需要完全控制内容节点时使用 <CodeLabel text="renderContent" />。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <NotificationPanel
                className="w-full"
                notifications={[CUSTOM_CONTENT_NOTIFICATION]}
                typeRegistry={DEMO_NOTIFICATION_TYPES}
                renderContent={(notification) => (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2
                      className="size-3.5"
                      style={{ color: "var(--lg-primary)" }}
                      aria-hidden="true"
                    />
                    {notification.content}
                  </span>
                )}
              />
              <p className="text-sm text-on-surface-variant">
                <CodeLabel text="renderContent" /> 优先级高于{" "}
                <CodeLabel text="emphasis" />
                ；默认渲染仍可通过 <CodeLabel text="NotificationContent" />{" "}
                复用实体 chip。
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* =================== 数据接入 =================== */}
      <Section title="数据接入">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">组件不取数</CardTitle>
            <CardDescription>
              <CodeLabel text="NotificationPanel" /> 只接收 view model 与回调；
              真实项目按 AGENTS.md 用 TanStack Query + services 接入。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <pre className="overflow-x-auto rounded-lg border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-container)] p-3 font-mono text-[11px] leading-relaxed text-[var(--lg-text-secondary)]">
              <code>{QUERY_ADAPTER_SNIPPET}</code>
            </pre>
            <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <Inbox className="size-3.5" aria-hidden="true" />
                空态：暂无新消息
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                错误态：仅列表为空时展示
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-3.5" aria-hidden="true" />
                重试：交给调用方
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bell className="size-3.5" aria-hidden="true" />
                模板展示：/components/notifications
              </span>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

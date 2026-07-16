import { Bell, Mail, Plus, Settings, User } from "lucide-react"

import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Section } from "@/pages/sections/shared"

export default function FoundationsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="基础元素"
        description="Cards, Buttons, Badges, Typography & Data Colors"
      />

      {/* =================== Cards =================== */}
      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-base">Glass Card</CardTitle>
              <CardDescription>variant="glass" (默认)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-on-surface-variant">
                带外部阴影和顶部反射渐变高光的毛玻璃卡片。适合核心数据指标、大屏展示区及主要内容区块。
              </p>
            </CardContent>
          </Card>

          <Card variant="liquid">
            <CardHeader>
              <CardTitle className="text-base">Liquid Card</CardTitle>
              <CardDescription>variant="liquid"</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-on-surface-variant">
                无阴影但保留反光渐变的毛玻璃卡片。适合用在二级内容、列表条目，或多层复杂嵌套卡片。
              </p>
            </CardContent>
          </Card>

          <Card variant="matte">
            <CardHeader>
              <CardTitle className="text-base">Matte Card</CardTitle>
              <CardDescription>variant="matte"</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-on-surface-variant">
                无反光渐变、无阴影的半透明哑光卡片。适合日常设置表单、系统配置项以及辅助操作控制台。
              </p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <CardTitle className="text-base">Default Card</CardTitle>
              <CardDescription>variant="default"</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-on-surface-variant">
                基础卡片。使用传统实色背景，没有模糊与光泽特效。适合极简传统布局或强背景色彩对比。
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* =================== Buttons =================== */}
      <Section title="Buttons">
        <Card className="glass-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <Button>
              <Plus data-icon="inline-start" /> 主色按钮
            </Button>
            <Button variant="secondary">
              <Settings data-icon="inline-start" /> 次要按钮
            </Button>
            <Button variant="outline">
              <Mail data-icon="inline-start" /> 描边按钮
            </Button>
            <Button variant="ghost">
              <Bell data-icon="inline-start" /> Ghost
            </Button>
            <Button variant="destructive">危险操作</Button>
            <Button disabled>禁用状态</Button>
            <Button
              size="icon"
              variant="outline"
              className="size-9 rounded-full"
            >
              <User />
            </Button>
          </CardContent>
        </Card>

        {/* Size Matrix */}
        <Card className="glass-card mt-4">
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="data-label">SIZE MATRIX</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="icon" variant="outline" className="rounded-full">
                <Plus />
              </Button>
              <Button size="sm">
                <Plus data-icon="inline-start" /> Small
              </Button>
              <Button size="default">
                <Plus data-icon="inline-start" /> Default
              </Button>
              <Button size="lg">
                <Plus data-icon="inline-start" /> Large
              </Button>
            </div>

            <p className="data-label mt-4">LOADING STATE</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>
                <Spinner data-icon="inline-start" /> Loading...
              </Button>
              <Button disabled variant="secondary">
                <Spinner data-icon="inline-start" /> Loading...
              </Button>
              <Button disabled variant="outline">
                <Spinner data-icon="inline-start" /> Loading...
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* =================== Badges & Tags =================== */}
      <Section title="Badges & Tags">
        <Card className="glass-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Separator orientation="vertical" className="!h-5" />
            <Badge variant="success">Success</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="info">Info</Badge>
            <Separator orientation="vertical" className="!h-5" />
            <Badge variant="success">success</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="purple">purple</Badge>
            <Badge variant="danger">danger</Badge>
          </CardContent>
        </Card>
      </Section>

      {/* =================== Typography =================== */}
      <Section title="Typography">
        <Card className="glass-card">
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="font-h1">Heading 1 — Manrope 36px</p>
            <p className="font-h2">Heading 2 — Manrope 24px</p>
            <p className="section-title">Section Title — Manrope 20px</p>
            <p className="text-sm text-on-surface">
              Body Text — Inter 14px. The quick brown fox jumps over the lazy
              dog.
            </p>
            <p className="data-label">
              DATA LABEL — JetBrains Mono 11px UPPERCASE
            </p>
            <p className="font-data-display text-primary-accent">42.5K</p>
            <p className="font-label-mono text-outline">
              MONO LABEL — JetBrains Mono 11px
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* =================== Data Colors =================== */}
      <Section title="Semantic Data Colors">
        <Card className="glass-card">
          <CardContent className="flex flex-wrap gap-3 p-6">
            {[
              {
                label: "Link",
                bg: "var(--data-link-bg)",
                color: "var(--data-link)",
                border: "var(--data-link-border)",
              },
              {
                label: "Added",
                bg: "var(--data-added-bg)",
                color: "var(--data-added)",
                border: "var(--data-added-border)",
              },
              {
                label: "Deleted",
                bg: "var(--data-deleted-bg)",
                color: "var(--data-deleted)",
                border: "var(--data-deleted-border)",
              },
              {
                label: "AI",
                bg: "var(--data-ai-bg)",
                color: "var(--data-ai)",
                border: "var(--data-ai-border)",
              },
            ].map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium"
                style={{
                  background: c.bg,
                  color: c.color,
                  border: `1px solid ${c.border}`,
                }}
              >
                {c.label}
              </span>
            ))}
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

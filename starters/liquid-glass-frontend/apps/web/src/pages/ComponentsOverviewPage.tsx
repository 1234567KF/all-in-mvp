import { ArrowRight, BarChart3, FormInput, Layers, Palette } from "lucide-react"
import { Link } from "react-router-dom"

import { PageHeader } from "@/components/layout/PageHeader"
import { Card } from "@/components/ui/card"

const categories = [
  {
    icon: Palette,
    name: "基础元素",
    description: "Cards, Buttons, Badges, Typography, Colors",
    path: "/components/foundations",
  },
  {
    icon: FormInput,
    name: "表单与输入",
    description: "Inputs, Select, Checkbox, Calendar, DatePicker",
    path: "/components/forms",
  },
  {
    icon: BarChart3,
    name: "数据展示",
    description: "KPI, DataTable, Pagination, Progress",
    path: "/components/data",
  },
  {
    icon: Layers,
    name: "浮层与导航",
    description: "Tabs, Dialog, Sheet, Alerts, Toast",
    path: "/components/overlays",
  },
]

export default function ComponentsOverviewPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="Components"
        description="Liquid Glass Design System 组件参考"
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {categories.map((cat) => (
          <Link
            key={cat.path}
            to={cat.path}
            viewTransition
            className="group block"
          >
            <Card className="glass-card h-full transition-all hover:ring-1 hover:ring-[var(--lg-primary)]/40">
              <div className="flex items-start gap-4 p-6">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--lg-primary-dim)",
                    color: "var(--lg-primary-light)",
                  }}
                >
                  <cat.icon className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <h3 className="text-base font-semibold text-on-surface">
                    {cat.name}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    {cat.description}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 self-center text-primary-accent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

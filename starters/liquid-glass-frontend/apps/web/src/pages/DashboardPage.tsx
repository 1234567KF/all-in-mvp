import { Activity, Code2, Users, Zap } from "lucide-react"
import { useState } from "react"
import { type DateRange } from "react-day-picker"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { type ColumnDef, DataTable } from "@/components/shared/DataTable"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { KpiCard } from "@/components/ui/kpi-card"

/* ── Mock data ── */
const tableData = [
  {
    name: "Alice Wang",
    role: "Frontend",
    commits: 142,
    ai: "68%",
    status: "active",
  },
  {
    name: "Bob Zhang",
    role: "Backend",
    commits: 98,
    ai: "45%",
    status: "active",
  },
  {
    name: "Carol Li",
    role: "Fullstack",
    commits: 201,
    ai: "72%",
    status: "active",
  },
  {
    name: "David Chen",
    role: "DevOps",
    commits: 56,
    ai: "23%",
    status: "inactive",
  },
  {
    name: "Eve Liu",
    role: "Frontend",
    commits: 167,
    ai: "81%",
    status: "active",
  },
]

/* ── Page ── */
export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })

  // Recharts Mock Data
  const trendData = [
    { name: "Jan", commits: 40 },
    { name: "Feb", commits: 65 },
    { name: "Mar", commits: 45 },
    { name: "Apr", commits: 80 },
    { name: "May", commits: 55 },
    { name: "Jun", commits: 90 },
    { name: "Jul", commits: 70 },
    { name: "Aug", commits: 85 },
    { name: "Sep", commits: 60 },
    { name: "Oct", commits: 95 },
    { name: "Nov", commits: 75 },
    { name: "Dec", commits: 88 },
  ]

  const trendChartConfig = {
    commits: {
      label: "Commits",
      color: "var(--lg-primary)",
    },
  } satisfies ChartConfig

  const pieData = [
    { name: "Frontend", value: 450, color: "var(--lg-primary)" },
    { name: "Backend", value: 250, color: "var(--lg-secondary-accent)" },
    { name: "DevOps", value: 147, color: "var(--lg-tertiary-accent)" },
  ]

  const pieChartConfig = {
    Frontend: {
      label: "Frontend",
      color: "var(--lg-primary)",
    },
    Backend: {
      label: "Backend",
      color: "var(--lg-secondary-accent)",
    },
    DevOps: {
      label: "DevOps",
      color: "var(--lg-tertiary-accent)",
    },
  } satisfies ChartConfig

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-h2 text-on-surface">Dashboard</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            示例仪表盘页面 — 展示 KPI 卡片、动态图表和数据表格
          </p>
        </div>
        <div>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Users"
          value="2,847"
          icon={Users}
          accentColor="blue"
          trend={{ value: "+12.5%", direction: "up", label: "vs last month" }}
        />
        <KpiCard
          title="Active Sessions"
          value="1,203"
          icon={Activity}
          accentColor="green"
          trend={{ value: "+8.2%", direction: "up", label: "vs last month" }}
        />
        <KpiCard
          title="AI Code Ratio"
          value="64.3%"
          icon={Code2}
          accentColor="purple"
          trend={{ value: "+5.1%", direction: "up", label: "vs last month" }}
        />
        <KpiCard
          title="Avg Response"
          value="1.2s"
          icon={Zap}
          accentColor="yellow"
          trend={{ value: "-15.3%", direction: "down", label: "vs last month" }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Real Chart 1: Revenue Trend (BarChart) */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="section-title !mb-0">Commits Trend</CardTitle>
            <CardDescription>按月度统计的提交总数趋势</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px] w-full pt-4">
            <ChartContainer config={trendChartConfig} className="h-full w-full">
              <BarChart
                data={trendData}
                margin={{ top: 0, right: 0, left: -25, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--lg-border-subtle)"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "var(--lg-text-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "var(--lg-text-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="commits"
                  fill="var(--lg-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Real Chart 2: Category Distribution (PieChart) */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="section-title !mb-0">
              Category Distribution
            </CardTitle>
            <CardDescription>成员技术栈方向的分布占比</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col justify-between pt-4">
            <div className="h-[160px] w-full">
              <ChartContainer config={pieChartConfig} className="h-full w-full">
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey="name" />}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={70}
                    stroke="var(--lg-surface)"
                    strokeWidth={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4">
              {pieData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      {(() => {
        const columns: ColumnDef<(typeof tableData)[number]>[] = [
          {
            header: "Name",
            accessor: (row) => (
              <div className="flex items-center gap-3">
                <Avatar className="size-7">
                  <AvatarFallback
                    style={{
                      background: "var(--lg-primary-dim)",
                      color: "var(--lg-primary-light)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {row.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-on-surface">
                  {row.name}
                </span>
              </div>
            ),
          },
          {
            header: "Role",
            headerClassName: "hidden sm:table-cell",
            className: "hidden sm:table-cell",
            accessor: (row) => <Badge variant="info">{row.role}</Badge>,
          },
          {
            header: "Commits",
            headerClassName: "text-right",
            className: "text-right font-mono text-sm tabular-nums",
            accessor: "commits",
          },
          {
            header: "AI Ratio",
            headerClassName: "text-right hidden sm:table-cell",
            className:
              "text-right font-mono text-sm tabular-nums hidden sm:table-cell",
            accessor: "ai",
          },
          {
            header: "Status",
            accessor: (row) => (
              <Badge variant={row.status === "active" ? "success" : "danger"}>
                {row.status}
              </Badge>
            ),
          },
        ]

        return (
          <DataTable
            columns={columns}
            data={tableData}
            rowKey="name"
            toolbar={
              <>
                <CardTitle className="section-title !mb-0">
                  Team Members
                </CardTitle>
                <Badge variant="success">
                  {tableData.filter((r) => r.status === "active").length} Active
                </Badge>
              </>
            }
          />
        )
      })()}

      {/* Footer hint */}
      <p className="text-center text-xs text-outline">
        按{" "}
        <kbd className="rounded border border-border bg-[var(--lg-surface-container)] px-1.5 py-0.5 font-mono text-[10px]">
          D
        </kbd>{" "}
        切换 Dark/Light 主题
      </p>
    </div>
  )
}

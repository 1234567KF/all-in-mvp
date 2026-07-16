import {
  DollarSign,
  Inbox,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { useState } from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import { type ColumnDef, DataTable } from "@/components/shared/DataTable"
import { SmartPagination } from "@/components/shared/SmartPagination"
import { TableEmptyState } from "@/components/shared/TableEmptyState"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { KpiCard } from "@/components/ui/kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CodeLabel, Section } from "@/pages/sections/shared"

export default function DataPage() {
  const [page, setPage] = useState(1)
  const [smartPage, setSmartPage] = useState(1)
  const [smartPageSmall, setSmartPageSmall] = useState(1)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="数据展示"
        description="KPI, DataTable, Pagination, Progress & Status"
      />

      {/* =================== KPI Accent =================== */}
      <Section title="KPI Accent Bars">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <KpiCard
            title="Monthly Revenue"
            value="$42.5K"
            icon={DollarSign}
            accentColor="green"
            trend={{ value: "+12.5%", direction: "up", label: "环比上月" }}
          />
          <KpiCard
            title="Active Users"
            value="1,284"
            icon={Users}
            accentColor="blue"
            trend={{ value: "持平", direction: "flat" }}
          />
          <KpiCard
            title="Conversion"
            value="3.2%"
            icon={Percent}
            accentColor="red"
            trend={{ value: "-0.4%", direction: "down", label: "较昨日" }}
          />
        </div>
      </Section>

      {/* =================== Paginated DataTable =================== */}
      {(() => {
        const PAGE_SIZE = 5
        const mockRows = [
          {
            id: "EMP-001",
            name: "Alice Chen",
            dept: "Engineering",
            status: "active",
            usage: 82,
          },
          {
            id: "EMP-002",
            name: "Bob Wang",
            dept: "Design",
            status: "active",
            usage: 64,
          },
          {
            id: "EMP-003",
            name: "Carol Li",
            dept: "Engineering",
            status: "inactive",
            usage: 0,
          },
          {
            id: "EMP-004",
            name: "David Zhang",
            dept: "Product",
            status: "active",
            usage: 95,
          },
          {
            id: "EMP-005",
            name: "Eva Liu",
            dept: "Marketing",
            status: "active",
            usage: 47,
          },
          {
            id: "EMP-006",
            name: "Frank Wu",
            dept: "Engineering",
            status: "active",
            usage: 78,
          },
          {
            id: "EMP-007",
            name: "Grace Hu",
            dept: "Design",
            status: "inactive",
            usage: 12,
          },
          {
            id: "EMP-008",
            name: "Henry Zhou",
            dept: "Product",
            status: "active",
            usage: 88,
          },
          {
            id: "EMP-009",
            name: "Ivy Sun",
            dept: "Engineering",
            status: "active",
            usage: 56,
          },
          {
            id: "EMP-010",
            name: "Jack Yang",
            dept: "Marketing",
            status: "active",
            usage: 71,
          },
          {
            id: "EMP-011",
            name: "Katie Zhao",
            dept: "Design",
            status: "active",
            usage: 63,
          },
          {
            id: "EMP-012",
            name: "Leo Huang",
            dept: "Engineering",
            status: "inactive",
            usage: 0,
          },
          {
            id: "EMP-013",
            name: "Mia Xu",
            dept: "Product",
            status: "active",
            usage: 42,
          },
        ]
        const totalPages = Math.ceil(mockRows.length / PAGE_SIZE)
        const start = (page - 1) * PAGE_SIZE
        const rows = mockRows.slice(start, start + PAGE_SIZE)

        const columns: ColumnDef<(typeof mockRows)[number]>[] = [
          {
            header: "ID",
            accessor: "id",
            headerClassName: "hidden sm:table-cell",
            className:
              "font-mono text-xs text-muted-foreground hidden sm:table-cell",
          },
          {
            header: "Employee / Dept",
            accessor: (row) => (
              <div className="flex items-center gap-3">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-[var(--lg-primary-dim)] text-[10px] font-semibold text-[var(--lg-primary-light)]">
                    {row.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm leading-tight font-medium text-foreground">
                    {row.name}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {row.dept}
                  </span>
                </div>
              </div>
            ),
          },
          {
            header: "Status",
            accessor: (row) => (
              <Badge variant={row.status === "active" ? "success" : "danger"}>
                {row.status}
              </Badge>
            ),
          },
          {
            header: "Usage %",
            headerClassName: "!text-right",
            className: "!text-right",
            accessor: (row) => (
              <div className="flex items-center justify-end gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${row.usage}%`,
                      background:
                        row.usage > 80
                          ? "var(--data-danger)"
                          : row.usage > 50
                            ? "var(--data-warning)"
                            : "var(--data-success)",
                    }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-sm text-muted-foreground tabular-nums">
                  {row.usage}
                </span>
              </div>
            ),
          },
        ]

        return (
          <Section title="Paginated DataTable">
            <DataTable
              columns={columns}
              data={rows}
              rowKey="id"
              total={mockRows.length}
              pagination={{
                currentPage: page,
                totalPages,
                onPageChange: setPage,
              }}
              toolbar={
                <>
                  <div className="relative w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" />
                    <Input
                      placeholder="Search members..."
                      className="border-border bg-[var(--glass-input-bg)] pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Button size="sm" variant="secondary">
                      <Plus data-icon="inline-start" />
                      <span>Add</span>
                    </Button>
                    <span
                      className="data-label flex items-center gap-1.5"
                      style={{ fontSize: 11 }}
                    >
                      TOTAL:{" "}
                      <span className="font-mono text-base font-bold text-foreground">
                        {mockRows.length}
                      </span>
                    </span>
                  </div>
                </>
              }
            />
            <p className="mt-3 text-xs text-outline">
              Built with <CodeLabel text="DataTable" /> +{" "}
              <CodeLabel text="SmartPagination" />.
            </p>
          </Section>
        )
      })()}

      {/* =================== Empty & Loading States =================== */}
      <Section title="Empty & Loading States (缺省与加载状态)">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Empty State Card */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader className="px-6 py-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Empty State (常规缺省)
                </CardTitle>
                <CardDescription>无可显示数据时的卡片/整页占位</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pt-2 pb-6">
                <Empty className="glass-card border-dashed bg-transparent p-6">
                  <EmptyHeader>
                    <EmptyMedia
                      variant="icon"
                      className="bg-[var(--lg-primary-dim)] text-[var(--lg-primary-light)]"
                    >
                      <Inbox className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="text-foreground">
                      暂无分析历史数据
                    </EmptyTitle>
                    <EmptyDescription>
                      您的代理尚未提交任何最近的监控事件。请在配置文件中启用监测并重新提交。
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm">
                      <RefreshCw data-icon="inline-start" />
                      <span>重试连接</span>
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </div>
          </Card>

          {/* TableEmptyState */}
          <Card className="glass-card gap-0 overflow-hidden p-0 py-0">
            <CardHeader className="px-6 py-4">
              <CardTitle className="text-base">表格空状态</CardTitle>
              <CardDescription>TableEmptyState 组件</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="data-label">Name</TableHead>
                  <TableHead className="data-label">Status</TableHead>
                  <TableHead className="data-label">Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmptyState
                  icon={<Inbox className="size-12" />}
                  title="暂无成员数据"
                  description="请先添加团队成员或同步组织架构"
                  colSpan={3}
                />
              </TableBody>
            </Table>
          </Card>

          {/* TableSkeleton */}
          <Card className="glass-card gap-0 overflow-hidden p-0 py-0">
            <CardHeader className="px-6 py-4">
              <CardTitle className="text-base">表格骨架屏</CardTitle>
              <CardDescription>TableSkeleton 组件</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="data-label">Name</TableHead>
                  <TableHead className="data-label">Dept</TableHead>
                  <TableHead className="data-label">Status</TableHead>
                  <TableHead className="data-label !text-right">
                    Usage
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton rows={4} columns={4} />
              </TableBody>
            </Table>
          </Card>
        </div>
      </Section>

      {/* =================== SmartPagination =================== */}
      <Section title="SmartPagination">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">智能分页</CardTitle>
            <CardDescription>
              自动折叠页码，含省略号逻辑，totalPages=20
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                当前页：
                <span className="font-mono font-bold text-foreground">
                  {smartPage}
                </span>{" "}
                / 20
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSmartPage(1)}
              >
                重置
              </Button>
            </div>
            <SmartPagination
              currentPage={smartPage}
              totalPages={20}
              onPageChange={setSmartPage}
            />
          </CardContent>
        </Card>
      </Section>

      {/* =================== SmartPagination (少页数) =================== */}
      <Section title="SmartPagination (少页数)">
        <Card className="glass-card">
          <CardContent className="p-6">
            <SmartPagination
              currentPage={smartPageSmall}
              totalPages={5}
              onPageChange={setSmartPageSmall}
            />
          </CardContent>
        </Card>
      </Section>

      {/* =================== Skeleton =================== */}
      <Section title="Skeleton Loading (骨架屏加载)">
        <div className="grid gap-6 md:grid-cols-2">
          {/* 基础骨架屏 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">基础骨架屏</CardTitle>
              <CardDescription>文本行 + 块状区域</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-6">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-4 h-24 w-full" />
            </CardContent>
          </Card>

          {/* 卡片骨架屏 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">卡片骨架屏</CardTitle>
              <CardDescription>模拟内容卡片加载态</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <Card className="glass-card">
                <CardHeader>
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[300px]" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[120px] w-full" />
                </CardContent>
              </Card>

              {/* 列表骨架屏 */}
              <p className="text-xs tracking-wider text-muted-foreground uppercase">
                列表骨架屏
              </p>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-[120px]" />
                    <Skeleton className="h-2.5 w-[80px]" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  )
}

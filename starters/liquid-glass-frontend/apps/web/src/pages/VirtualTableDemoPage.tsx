/**
 * VirtualTableDemoPage — 虚拟滚动大数据表格 Demo
 *
 * 展示 VirtualDataTable 组件渲染 10000 行模拟数据的性能表现。
 */

import { useMemo } from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import {
  type VirtualColumnDef,
  VirtualDataTable,
} from "@/components/shared/VirtualDataTable"
import { Badge } from "@/components/ui/badge"

interface MockRecord {
  id: number
  name: string
  email: string
  department: string
  role: string
  status: "active" | "inactive" | "pending"
  salary: number
  joinDate: string
}

const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Product",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
]
const ROLES = [
  "Manager",
  "Senior",
  "Mid-level",
  "Junior",
  "Intern",
  "Lead",
  "Director",
]
const STATUSES: MockRecord["status"][] = ["active", "inactive", "pending"]

function generateMockData(count: number): MockRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    role: ROLES[i % ROLES.length],
    status: STATUSES[i % STATUSES.length],
    salary: 50000 + Math.floor(Math.random() * 100000),
    joinDate: new Date(2020, i % 12, (i % 28) + 1).toISOString().split("T")[0],
  }))
}

const statusVariantMap: Record<
  MockRecord["status"],
  "default" | "secondary" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  pending: "outline",
}

const columns: VirtualColumnDef<MockRecord>[] = [
  { header: "ID", accessor: "id", width: "80px" },
  { header: "Name", accessor: "name", width: "140px" },
  { header: "Email", accessor: "email", width: "220px" },
  { header: "Department", accessor: "department", width: "140px" },
  { header: "Role", accessor: "role", width: "120px" },
  {
    header: "Status",
    accessor: (row) => (
      <Badge variant={statusVariantMap[row.status]}>{row.status}</Badge>
    ),
    width: "100px",
  },
  {
    header: "Salary",
    accessor: (row) => `$${row.salary.toLocaleString()}`,
    width: "120px",
    className: "font-mono",
  },
  { header: "Join Date", accessor: "joinDate", width: "120px" },
]

export default function VirtualTableDemoPage() {
  const data = useMemo(() => generateMockData(10000), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="虚拟滚动表格"
        description="基于 @tanstack/react-virtual 实现行虚拟化，流畅渲染 10,000 行数据"
      />

      <div className="px-1">
        <p className="mb-4 text-sm text-muted-foreground">
          当前渲染{" "}
          <span className="font-mono font-semibold text-foreground">
            {data.length.toLocaleString()}
          </span>{" "}
          行数据，仅可视区域内的行被真实渲染到 DOM。
        </p>

        <VirtualDataTable
          data={data}
          columns={columns}
          rowHeight={48}
          maxHeight={600}
          onRowClick={(row) => console.log("Row clicked:", row)}
        />
      </div>
    </div>
  )
}

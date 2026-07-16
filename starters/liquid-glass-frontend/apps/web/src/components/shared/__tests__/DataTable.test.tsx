/**
 * DataTable 组件测试 — 示例模板
 *
 * 演示如何使用 @testing-library/react 测试泛型表格组件：
 *   - 空数据展示（TableEmptyState）
 *   - 有数据时的行渲染
 *   - loading 骨架屏展示
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ColumnDef } from "@/components/shared/DataTable"
import { DataTable } from "@/components/shared/DataTable"

interface Row {
  id: number
  name: string
}

const columns: ColumnDef<Row>[] = [
  { header: "ID", accessor: "id" },
  { header: "名称", accessor: "name" },
]

const rows: Row[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Carol" },
]

describe("DataTable", () => {
  it("空数据时展示空状态标题", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="没有任何记录" />)

    expect(screen.getByText("没有任何记录")).toBeInTheDocument()
  })

  it("有数据时渲染正确的行数", () => {
    render(<DataTable columns={columns} data={rows} rowKey="id" />)

    // 每个单元格内容都应出现
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("Carol")).toBeInTheDocument()

    // 表体行数 = 数据条数
    const bodyRows = screen
      .getAllByRole("row")
      .filter((row) => row.querySelector("td"))
    expect(bodyRows).toHaveLength(rows.length)
  })

  it("loading 状态展示骨架屏而非数据行", () => {
    const { container } = render(
      <DataTable columns={columns} data={rows} loading skeletonRows={4} />
    )

    // 骨架屏元素存在
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)

    // loading 时不渲染真实数据
    expect(screen.queryByText("Alice")).not.toBeInTheDocument()
  })
})

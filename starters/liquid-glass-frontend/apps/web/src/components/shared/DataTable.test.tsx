/**
 * DataTable 单元测试
 * 覆盖：列/行渲染（accessor 与 render）、空状态、loading 骨架、
 * 行点击、冻结列标记、总数显示与分页回调、mobileCard 卡片模式、draggable 拖拽把手
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ColumnDef } from "@/components/shared/DataTable"
import { DataTable } from "@/components/shared/DataTable"

// 可控的 useIsMobile mock（默认桌面端，卡片模式用例内改为 true）
const { isMobileMock } = vi.hoisted(() => ({
  isMobileMock: vi.fn(() => false),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: isMobileMock }))

interface Row {
  id: string
  name: string
  amount: number
}

const rows: Row[] = [
  { id: "r1", name: "Alice", amount: 100 },
  { id: "r2", name: "Bob", amount: 200 },
]

const columns: ColumnDef<Row>[] = [
  { header: "名称", accessor: "name" },
  { header: "金额", accessor: (row) => `¥${row.amount}` },
  { header: "操作", render: (row) => <button>编辑-{row.id}</button> },
]

describe("DataTable", () => {
  it("渲染表头与数据行（字段/函数 accessor 与 render 列）", () => {
    render(<DataTable columns={columns} data={rows} rowKey="id" />)

    for (const header of ["名称", "金额", "操作"]) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("¥200")).toBeInTheDocument()
    expect(screen.getByText("编辑-r1")).toBeInTheDocument()
  })

  it("空数据展示空状态标题与描述", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyTitle="暂无记录"
        emptyDescription="点击右上角新增"
      />
    )
    expect(screen.getByText("暂无记录")).toBeInTheDocument()
    expect(screen.getByText("点击右上角新增")).toBeInTheDocument()
  })

  it("isFiltered 时空状态显示未找到匹配结果而非默认文案", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyTitle="暂无记录"
        emptyDescription="点击右上角新增"
        isFiltered
      />
    )
    expect(screen.getByText("未找到匹配结果")).toBeInTheDocument()
    expect(screen.getByText("尝试调整搜索关键词或筛选条件")).toBeInTheDocument()
    expect(screen.queryByText("暂无记录")).not.toBeInTheDocument()
  })

  it("loading 时渲染骨架屏而非数据/空状态", () => {
    const { container } = render(
      <DataTable columns={columns} data={rows} loading skeletonRows={3} />
    )
    expect(screen.queryByText("Alice")).not.toBeInTheDocument()
    expect(screen.queryByText("暂无数据")).not.toBeInTheDocument()
    // 3 行 × 3 列骨架
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(9)
  })

  it("点击行触发 onRowClick 并携带行数据与索引", () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={rows}
        rowKey="id"
        onRowClick={onRowClick}
      />
    )
    fireEvent.click(screen.getByText("Bob"))
    expect(onRowClick).toHaveBeenCalledWith(rows[1], 1)
  })

  it("冻结列在表头与单元格输出 data-frozen 标记", () => {
    const frozenCols: ColumnDef<Row>[] = [
      { header: "名称", accessor: "name", frozen: "left" },
      { header: "操作", render: () => <span>op</span>, frozen: "right" },
    ]
    const { container } = render(
      <DataTable columns={frozenCols} data={rows} rowKey="id" />
    )
    expect(container.querySelectorAll('th[data-frozen="left"]')).toHaveLength(1)
    expect(container.querySelectorAll('td[data-frozen="right"]')).toHaveLength(
      rows.length
    )
  })

  it("无分页时头部显示总记录数", () => {
    render(<DataTable columns={columns} data={rows} total={42} />)
    expect(screen.getByText("共 42 条记录")).toBeInTheDocument()
  })

  it("多页时渲染分页并透传 onPageChange", () => {
    const onPageChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={rows}
        rowKey="id"
        total={20}
        pagination={{ currentPage: 1, totalPages: 3, onPageChange }}
      />
    )
    expect(screen.getByText("共 20 条")).toBeInTheDocument()
    fireEvent.click(screen.getByText("2"))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("totalPages <= 1 时不渲染分页页脚", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        rowKey="id"
        total={2}
        pagination={{ currentPage: 1, totalPages: 1, onPageChange: vi.fn() }}
      />
    )
    expect(screen.queryByText("共 2 条")).not.toBeInTheDocument()
    // 退化为头部总数显示
    expect(screen.getByText("共 2 条记录")).toBeInTheDocument()
  })

  it("draggable 时渲染拖拽把手列", () => {
    render(<DataTable columns={columns} data={rows} rowKey="id" draggable />)
    expect(screen.getAllByTitle("按住拖拽排序")).toHaveLength(rows.length)
  })

  describe("mobileCard 卡片模式", () => {
    afterEach(() => {
      isMobileMock.mockReturnValue(false)
    })

    const mobileCard = (row: Row) => (
      <div>
        卡片-{row.name}（¥{row.amount}）
      </div>
    )

    it("移动端传入 mobileCard 时渲染卡片列表而非表格（单树）", () => {
      isMobileMock.mockReturnValue(true)
      const { container } = render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          mobileCard={mobileCard}
        />
      )
      expect(container.querySelector("table")).not.toBeInTheDocument()
      expect(
        container.querySelector('[data-slot="data-card-list"]')
      ).toBeInTheDocument()
      expect(screen.getByText(/卡片-Alice/)).toBeInTheDocument()
    })

    it("移动端未传 mobileCard 时仍渲染表格（向后兼容）", () => {
      isMobileMock.mockReturnValue(true)
      const { container } = render(
        <DataTable columns={columns} data={rows} rowKey="id" />
      )
      expect(container.querySelector("table")).toBeInTheDocument()
      expect(
        container.querySelector('[data-slot="data-card-list"]')
      ).not.toBeInTheDocument()
    })

    it("桌面端传入 mobileCard 时仍渲染表格", () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          mobileCard={mobileCard}
        />
      )
      expect(container.querySelector("table")).toBeInTheDocument()
      expect(screen.queryByText(/卡片-Alice/)).not.toBeInTheDocument()
    })

    it("点击卡片触发 onMobileCardClick（优先于 onRowClick）", () => {
      isMobileMock.mockReturnValue(true)
      const onMobileCardClick = vi.fn()
      const onRowClick = vi.fn()
      render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          mobileCard={mobileCard}
          onMobileCardClick={onMobileCardClick}
          onRowClick={onRowClick}
        />
      )
      fireEvent.click(screen.getByText(/卡片-Bob/))
      expect(onMobileCardClick).toHaveBeenCalledWith(rows[1], 1)
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it("未传 onMobileCardClick 时卡片点击回退 onRowClick", () => {
      isMobileMock.mockReturnValue(true)
      const onRowClick = vi.fn()
      render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          mobileCard={mobileCard}
          onRowClick={onRowClick}
        />
      )
      fireEvent.click(screen.getByText(/卡片-Alice/))
      expect(onRowClick).toHaveBeenCalledWith(rows[0], 0)
    })

    it("卡片模式空数据展示空状态（isFiltered 文案）", () => {
      isMobileMock.mockReturnValue(true)
      render(
        <DataTable
          columns={columns}
          data={[]}
          emptyTitle="暂无记录"
          mobileCard={mobileCard}
          isFiltered
        />
      )
      expect(screen.getByText("未找到匹配结果")).toBeInTheDocument()
      expect(screen.queryByText("暂无记录")).not.toBeInTheDocument()
    })

    it("卡片模式 loading 渲染卡片骨架", () => {
      isMobileMock.mockReturnValue(true)
      const { container } = render(
        <DataTable
          columns={columns}
          data={rows}
          loading
          skeletonRows={3}
          mobileCard={mobileCard}
        />
      )
      expect(screen.queryByText(/卡片-Alice/)).not.toBeInTheDocument()
      // 3 行 × 2 块骨架
      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
        6
      )
    })

    it("卡片模式 + draggable 渲染长按拖拽把手", () => {
      isMobileMock.mockReturnValue(true)
      render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          draggable
          onReorder={vi.fn()}
          mobileCard={mobileCard}
        />
      )
      // 每张卡片左侧渲染拖拽把手，卡片内容正常渲染
      expect(screen.getAllByTitle("按住拖拽排序")).toHaveLength(rows.length)
      expect(screen.getByText(/卡片-Alice/)).toBeInTheDocument()
    })

    it("卡片模式 + draggable 下卡片点击仍生效", () => {
      isMobileMock.mockReturnValue(true)
      const onRowClick = vi.fn()
      render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          draggable
          onReorder={vi.fn()}
          mobileCard={mobileCard}
          onRowClick={onRowClick}
        />
      )
      fireEvent.click(screen.getByText(/卡片-Bob/))
      expect(onRowClick).toHaveBeenCalledWith(rows[1], 1)
    })

    it("轻点拖拽把手不冒泡触发卡片点击", () => {
      isMobileMock.mockReturnValue(true)
      const onMobileCardClick = vi.fn()
      render(
        <DataTable
          columns={columns}
          data={rows}
          rowKey="id"
          draggable
          onReorder={vi.fn()}
          mobileCard={mobileCard}
          onMobileCardClick={onMobileCardClick}
        />
      )
      fireEvent.click(screen.getAllByTitle("按住拖拽排序")[0])
      expect(onMobileCardClick).not.toHaveBeenCalled()
    })
  })
})

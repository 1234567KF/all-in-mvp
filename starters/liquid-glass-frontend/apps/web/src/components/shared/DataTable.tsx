/**
 * DataTable — 声明式增强表格组件
 *
 * 整合 Card 容器 + 标准 Header 样式 + TableSkeleton + TableEmptyState + SmartPagination
 * 泛型实现，支持任意数据类型
 * 基于 @dnd-kit 实现 shadcn/ui 标准流体动画 Drag & Drop 行拖拽重排序
 */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronRight, GripVertical, SearchX } from "lucide-react"
import * as React from "react"

import { SmartPagination } from "@/components/shared/SmartPagination"
import { TableEmptyState } from "@/components/shared/TableEmptyState"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export interface ColumnDef<T> {
  header: string
  accessor?: keyof T | ((row: T) => React.ReactNode)
  className?: string
  headerClassName?: string

  /** 自定义单元格渲染，优先于 accessor */
  render?: (row: T, index: number) => React.ReactNode
  /** 冻结列，透传给 TableHead/TableCell */
  frozen?: "left" | "right"
  /** 列宽类名，e.g. "w-[160px] max-w-[160px]" */
  width?: string
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  skeletonRows?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ComponentType<{ className?: string }>
  /** 当前是否存在搜索/筛选条件（空状态时提示"未找到匹配结果"而非"暂无数据"） */
  isFiltered?: boolean
  /** 工具栏区（块级容器）：筛选/搜索用 FilterBar，多个元素需自行套一层 flex 行容器 */
  toolbar?: React.ReactNode
  total?: number
  pagination?: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  tableClassName?: string
  className?: string
  /** 用于生成行 key 的字段名或函数 */
  rowKey?: keyof T | ((row: T, index: number) => string | number)
  /** 行点击回调 */
  onRowClick?: (row: T, index: number) => void
  /** 行级样式类名 */
  rowClassName?: string | ((row: T, index: number) => string)
  /** 是否开启行拖拽排序 (结合 dnd-kit 实现流畅位移动画) */
  draggable?: boolean
  /** 拖拽排序完成回调 (fromIndex, toIndex) */
  onReorder?: (fromIndex: number, toIndex: number) => void
  /**
   * 移动端（<md）卡片渲染槽：传入后窄屏下渲染卡片列表替代横滚表格。
   * 卡片容器样式内置（分隔线/点击态/chevron），内容由页面提供；
   * onRowClick / 分页 / 空态 / toolbar / draggable 逻辑复用（卡片左侧渲染拖拽把手，长按激活）。
   * 未传入时行为完全不变（保持横向滚动）。
   */
  mobileCard?: (row: T, index: number) => React.ReactNode
  /** 卡片模式下点击整卡的回调（未传时回退 onRowClick）；不影响桌面表格行为 */
  onMobileCardClick?: (row: T, index: number) => void
  /**
   * 移动端卡片右侧是否渲染 ChevronRight (>) 箭头图标。
   * 默认为 true（有 onMobileCardClick 时渲染）；
   * 若 mobileCard 内已自带 renderActions(row) 操作按钮，可显式设为 false 以避免按钮与箭头重复堆叠。
   */
  showMobileChevron?: boolean
}

function getCellValue<T>(
  row: T,
  accessor: NonNullable<ColumnDef<T>["accessor"]>
): React.ReactNode {
  if (typeof accessor === "function") return accessor(row)
  return row[accessor] as React.ReactNode
}

function getRowKey<T>(
  row: T,
  index: number,
  rowKey?: DataTableProps<T>["rowKey"]
): string | number {
  if (!rowKey) return index
  if (typeof rowKey === "function") return rowKey(row, index)
  return row[rowKey] as string | number
}

// ─── 拖拽基础设施：表格行与卡片两分支共用 ───────────────────────────────

/** useSortable + 拖拽中样式计算（transform/transition/层级提升） */
function useSortableItem(id: string | number) {
  const sortable = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    position: sortable.isDragging ? "relative" : undefined,
    zIndex: sortable.isDragging ? 50 : undefined,
  }
  return { ...sortable, style }
}

/** 拖拽中的高亮容器样式 */
const DRAGGING_CLS =
  "z-50 bg-[var(--lg-surface-container)]/90 shadow-xl ring-2 ring-[var(--lg-primary)]/60 backdrop-blur-md"

/** 拖拽把手：touch-none 阻止浏览器滚动手势，touch-hit 扩展触摸命中区 */
function DragHandle(
  props: React.ComponentProps<"button"> & {
    listeners: ReturnType<typeof useSortable>["listeners"]
  }
) {
  const { listeners, className, ...rest } = props
  return (
    <button
      type="button"
      className={cn(
        "touch-hit inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded border border-transparent transition-all hover:border-border/50 hover:bg-muted/50 active:cursor-grabbing",
        className
      )}
      title="按住拖拽排序"
      // 轻点（未达长按/距离激活阈值）不冒泡触发行/卡片的 onRowClick
      onClick={(e) => e.stopPropagation()}
      {...rest}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  )
}

// ─── 子组件：基于 @dnd-kit/sortable 的可拖拽表格行 ──────────────────────────────
interface SortableRowProps<T> {
  id: string | number
  row: T
  idx: number
  columns: ColumnDef<T>[]
  onRowClick?: (row: T, index: number) => void
  rowClassName?: string | ((row: T, index: number) => string)
}

function SortableRow<T>({
  id,
  row,
  idx,
  columns,
  onRowClick,
  rowClassName,
}: SortableRowProps<T>) {
  const { attributes, listeners, setNodeRef, style, isDragging } =
    useSortableItem(id)

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/row border-b-[var(--lg-border-subtle)] transition-colors hover:bg-accent/30",
        isDragging && DRAGGING_CLS,
        typeof rowClassName === "function"
          ? rowClassName(row, idx)
          : rowClassName
      )}
      onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
    >
      <TableCell className="w-[40px] px-2 text-center text-muted-foreground/40 transition-colors group-hover/row:text-muted-foreground">
        <DragHandle listeners={listeners} {...attributes} />
      </TableCell>
      {columns.map((col, colIdx) => (
        <TableCell
          key={colIdx}
          frozen={col.frozen}
          className={cn(col.width, col.className)}
        >
          {col.render ? col.render(row, idx) : getCellValue(row, col.accessor!)}
        </TableCell>
      ))}
    </TableRow>
  )
}

// ─── 子组件：可拖拽移动端卡片（与 SortableRow 同构，把手长按激活） ─────────────

/** 卡片行基础样式（普通卡片与可拖拽卡片共用） */
const CARD_ROW_CLS =
  "flex items-center gap-3 border-b border-b-[var(--lg-border-subtle)] px-4 py-3.5 transition-colors last:border-b-0"

/** 可点击卡片的交互 props：点击 + 键盘可达（Enter/Space），两分支共用 */
function cardInteractiveProps<T>(
  onClick: ((row: T, index: number) => void) | undefined,
  row: T,
  idx: number
): React.HTMLAttributes<HTMLDivElement> {
  if (!onClick) return {}
  return {
    role: "button",
    tabIndex: 0,
    onClick: () => onClick(row, idx),
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onClick(row, idx)
      }
    },
  }
}

/** 卡片行容器：普通卡片与可拖拽卡片共用的外壳（分隔线/点击态/chevron） */
interface CardRowProps<T> {
  row: T
  idx: number
  onCardClick?: (row: T, index: number) => void
  rowClassName?: string | ((row: T, index: number) => string)
  /** 行容器附加类名（如拖拽中的高亮样式） */
  className?: string
  /** 内容区前置节点（如拖拽把手） */
  leading?: React.ReactNode
  /** 拖拽场景下绑定到外层盒子的 ref 与位移样式（transform 需作用于真实盒子） */
  nodeRef?: React.Ref<HTMLDivElement>
  style?: React.CSSProperties
  /** 是否渲染 Chevron 箭头图标 */
  showChevron?: boolean
  children: React.ReactNode
}

function CardRow<T>({
  row,
  idx,
  onCardClick,
  rowClassName,
  className,
  leading,
  nodeRef,
  style,
  showChevron = true,
  children,
}: CardRowProps<T>) {
  return (
    <div
      ref={nodeRef}
      style={style}
      className={cn(
        CARD_ROW_CLS,
        className,
        onCardClick && "cursor-pointer active:bg-accent/40",
        typeof rowClassName === "function"
          ? rowClassName(row, idx)
          : rowClassName
      )}
      {...cardInteractiveProps(onCardClick, row, idx)}
    >
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      {onCardClick && showChevron && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      )}
    </div>
  )
}

interface SortableCardProps<T> {
  id: string | number
  row: T
  idx: number
  mobileCard: (row: T, index: number) => React.ReactNode
  onCardClick?: (row: T, index: number) => void
  rowClassName?: string | ((row: T, index: number) => string)
  showChevron?: boolean
}

function SortableCard<T>({
  id,
  row,
  idx,
  mobileCard,
  onCardClick,
  rowClassName,
  showChevron = true,
}: SortableCardProps<T>) {
  const { attributes, listeners, setNodeRef, style, isDragging } =
    useSortableItem(id)

  return (
    <CardRow
      row={row}
      idx={idx}
      onCardClick={onCardClick}
      rowClassName={rowClassName}
      className={isDragging ? DRAGGING_CLS : undefined}
      nodeRef={setNodeRef}
      style={style}
      showChevron={showChevron}
      leading={
        <DragHandle
          listeners={listeners}
          className="text-muted-foreground/40"
          {...attributes}
        />
      }
    >
      {mobileCard(row, idx)}
    </CardRow>
  )
}

function DataTableInner<T>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "暂无数据",
  emptyDescription,
  emptyIcon: EmptyIcon,
  isFiltered = false,
  toolbar,
  total,
  pagination,
  tableClassName,
  className,
  rowKey,
  onRowClick,
  rowClassName,
  draggable = false,
  onReorder,
  mobileCard,
  onMobileCardClick,
  showMobileChevron = true,
}: DataTableProps<T>) {
  const isMobile = useIsMobile()
  const useCards = isMobile && !!mobileCard
  const cardClick = onMobileCardClick ?? onRowClick
  const showEmpty = !loading && data.length === 0
  const hasPagination = !!(pagination && pagination.totalPages > 1)
  const showHeader = !!(toolbar || (!hasPagination && total != null))

  // dnd-kit 传感器：桌面鼠标 4px 距离防单击误触发；触屏长按 250ms 激活，与滚动手势区分
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  )

  const itemIds = React.useMemo(() => {
    return data.map((row, idx) => getRowKey(row, idx, rowKey))
  }, [data, rowKey])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id && onReorder) {
      const oldIndex = itemIds.indexOf(active.id)
      const newIndex = itemIds.indexOf(over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex)
      }
    }
  }

  // 表格行与卡片两分支共用的拖拽上下文配置
  const dndContextProps = {
    sensors,
    collisionDetection: closestCenter,
    modifiers: [restrictToVerticalAxis, restrictToParentElement],
    onDragEnd: handleDragEnd,
  }

  return (
    <Card
      className={cn("glass-card gap-0 overflow-hidden p-0 py-0", className)}
    >
      {showHeader && (
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-border/30 bg-muted/40 px-4 py-2.5 sm:px-6 sm:py-3">
          {toolbar ? <div className="min-w-0 flex-1">{toolbar}</div> : <div />}
          {!hasPagination && total != null && (
            <span className="shrink-0 font-mono text-xs whitespace-nowrap text-muted-foreground">
              共 {total} 条记录
            </span>
          )}
        </div>
      )}

      {useCards ? (
        /* ── 移动端卡片列表（单树渲染，与表格互斥）── */
        <div data-slot="data-card-list">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 border-b border-b-[var(--lg-border-subtle)] px-4 py-4 last:border-b-0"
              >
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))
          ) : showEmpty ? (
            <Empty className="border-0 py-16">
              {(isFiltered || EmptyIcon) && (
                <EmptyMedia className="mb-4 size-12 text-muted-foreground/30">
                  {isFiltered ? (
                    <SearchX className="size-12" />
                  ) : EmptyIcon ? (
                    <EmptyIcon className="size-12" />
                  ) : null}
                </EmptyMedia>
              )}
              <EmptyTitle className="font-heading text-base font-semibold">
                {isFiltered ? "未找到匹配结果" : emptyTitle}
              </EmptyTitle>
              {(isFiltered || emptyDescription) && (
                <EmptyDescription className="mt-1">
                  {isFiltered
                    ? "尝试调整搜索关键词或筛选条件"
                    : emptyDescription}
                </EmptyDescription>
              )}
            </Empty>
          ) : draggable ? (
            <DndContext {...dndContextProps}>
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                {data.map((row, idx) => {
                  const id = getRowKey(row, idx, rowKey)
                  return (
                    <SortableCard
                      key={id}
                      id={id}
                      row={row}
                      idx={idx}
                      mobileCard={mobileCard!}
                      onCardClick={cardClick}
                      rowClassName={rowClassName}
                      showChevron={showMobileChevron}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          ) : (
            data.map((row, idx) => (
              <CardRow
                key={getRowKey(row, idx, rowKey)}
                row={row}
                idx={idx}
                onCardClick={cardClick}
                rowClassName={rowClassName}
                showChevron={showMobileChevron}
              >
                {mobileCard!(row, idx)}
              </CardRow>
            ))
          )}
        </div>
      ) : (
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow className="bg-muted/30 backdrop-blur-md hover:bg-muted/30">
              {draggable && <TableHead className="w-[40px] px-2 text-center" />}
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  frozen={col.frozen}
                  className={cn("data-label", col.width, col.headerClassName)}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton
                rows={skeletonRows}
                columnClasses={
                  draggable
                    ? ["w-[40px]", ...columns.map((col) => col.className)]
                    : columns.map((col) => col.className)
                }
              />
            ) : showEmpty ? (
              <TableEmptyState
                icon={
                  isFiltered ? (
                    <SearchX className="size-12" />
                  ) : EmptyIcon ? (
                    <EmptyIcon className="size-12" />
                  ) : undefined
                }
                title={isFiltered ? "未找到匹配结果" : emptyTitle}
                description={
                  isFiltered ? "尝试调整搜索关键词或筛选条件" : emptyDescription
                }
                colSpan={columns.length + (draggable ? 1 : 0)}
              />
            ) : draggable ? (
              <DndContext {...dndContextProps}>
                <SortableContext
                  items={itemIds}
                  strategy={verticalListSortingStrategy}
                >
                  {data.map((row, idx) => {
                    const id = getRowKey(row, idx, rowKey)
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        row={row}
                        idx={idx}
                        columns={columns}
                        onRowClick={onRowClick}
                        rowClassName={rowClassName}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              data.map((row, idx) => (
                <TableRow
                  key={getRowKey(row, idx, rowKey)}
                  className={cn(
                    "group/row border-b-[var(--lg-border-subtle)] transition-colors hover:bg-accent/30",
                    typeof rowClassName === "function"
                      ? rowClassName(row, idx)
                      : rowClassName
                  )}
                  onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {columns.map((col, colIdx) => (
                    <TableCell
                      key={colIdx}
                      frozen={col.frozen}
                      className={cn(col.width, col.className)}
                    >
                      {col.render
                        ? col.render(row, idx)
                        : getCellValue(row, col.accessor!)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {hasPagination && !showEmpty && (
        <div
          className="relative z-10 flex items-center justify-between border-t bg-muted/30 px-6 py-4"
          style={{ borderColor: "var(--lg-border-subtle)" }}
        >
          {total != null && (
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
          )}
          <div className={total != null ? "ml-auto" : "mx-auto"}>
            <SmartPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.onPageChange}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * React.memo 包装：跳过 props 未变化时的重渲染。
 * 通过泛型断言保留原始调用签名，外部 API 不变。
 */
export const DataTable = React.memo(DataTableInner) as typeof DataTableInner

/**
 * FilterBar — 筛选栏布局容器（响应式）
 *
 * 桌面（≥md）：flex 水平排列 + wrap + gap，接受任意子元素（现状行为）。
 * 移动（<md）：search 插槽保留在外，其余筛选控件收纳进"筛选"按钮
 * 唤起的底部抽屉（ResponsiveDialog），控件在抽屉内垂直堆叠并自动全宽。
 *
 * 可选：传入 labels 数组为每个子元素添加标签包裹（两分支共用）
 * 可选：useFormField=true 时使用 FormField 结构包裹（需要外层提供 FormProvider）
 */

import { Funnel } from "lucide-react"
import * as React from "react"

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/shared/ResponsiveDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface FilterBarProps {
  /**
   * 筛选栏子元素（Select、Input、Button 等）。
   * 注意：移动端分支在抽屉关闭时会卸载 children（Radix 关即卸），
   * 控件状态必须受控提升到页面层，非受控控件会在开关抽屉时丢失状态。
   * 可选：不传时移动端仅渲染 search 插槽，不显示"筛选"按钮。
   */
  children?: React.ReactNode
  /** 自定义 className */
  className?: string
  /**
   * 可选：为每个子元素提供标签文本数组。
   * 传入时每个子元素会被标签包裹；
   * 不传则仅作为纯布局容器（默认行为）。
   * 数组长度应与子元素数量一致，空字符串表示跳过对应子元素的包裹。
   */
  labels?: string[]
  /**
   * 可选：是否使用 FormField 结构包裹每个子元素（默认 false）。
   * 设为 true 时，每个子元素会被 FormField > FormItem > FormLabel 包裹；
   * 注意：需要外层存在 FormProvider（即 <Form>）上下文。
   */
  useFormField?: boolean
  /**
   * 可选：搜索框插槽。桌面排在 children 之前；
   * 移动端保留在筛选抽屉外（与"筛选"按钮同行，flex-1 占满）。
   */
  search?: React.ReactNode
  /** 可选：激活中的筛选条件数，>0 时移动端"筛选"按钮显示 badge */
  activeFilterCount?: number
  /** 可选：移动端筛选抽屉标题（默认"筛选"） */
  sheetTitle?: string
  /**
   * 可选：仅抽屉内生效的标签数组（规则同 labels）。
   * 适用于桌面无标签、但抽屉内垂直堆叠时需要字段标签的场景；
   * 未传时抽屉回退使用 labels。
   */
  sheetLabels?: string[]
}

/** 按 labels 约定包裹子元素（空字符串跳过包裹），桌面/抽屉两分支共用 */
function wrapWithLabels(
  children: React.ReactNode,
  labels: string[] | undefined,
  useFormField: boolean
): React.ReactNode {
  if (!labels || labels.length === 0) return children

  return React.Children.toArray(children).map((child, i) => {
    const label = labels[i] ?? ""
    if (!label) return child

    if (useFormField) {
      return (
        <FormField
          key={i}
          name={`filter-${i}` as never}
          render={() => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              {child}
            </FormItem>
          )}
        />
      )
    }

    return (
      <div key={i} className="flex flex-col gap-1.5">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        {child}
      </div>
    )
  })
}

function FilterBar({
  children,
  className,
  labels,
  useFormField = false,
  search,
  activeFilterCount = 0,
  sheetTitle = "筛选",
  sheetLabels,
}: FilterBarProps) {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const hasFilters = React.Children.count(children) > 0

  if (!isMobile) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        {search}
        {wrapWithLabels(children, labels, useFormField)}
      </div>
    )
  }

  // 移动端：无额外筛选控件时仅渲染 search，不显示"筛选"按钮
  if (!hasFilters) {
    return (
      <div className={cn("flex w-full items-center gap-2", className)}>
        {search && <div className="min-w-0 flex-1">{search}</div>}
      </div>
    )
  }

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      {search && <div className="min-w-0 flex-1">{search}</div>}
      <Button
        variant="outline"
        size="sm"
        className={cn("touch-hit h-9 shrink-0 gap-1.5", !search && "ml-auto")}
        onClick={() => setSheetOpen(true)}
      >
        <Funnel className="size-4" />
        筛选
        {activeFilterCount > 0 && (
          <Badge
            variant="secondary"
            className="h-5 min-w-5 rounded-full px-1.5 font-mono text-xs"
          >
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      <ResponsiveDialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{sheetTitle}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {/* 抽屉内控件垂直堆叠并全宽（覆盖页面侧的固定宽度类） */}
          <div className="flex flex-col gap-4 **:data-[slot=input]:w-full **:data-[slot=select-trigger]:w-full [&>*]:w-full [&>button]:w-auto">
            {wrapWithLabels(children, sheetLabels ?? labels, useFormField)}
          </div>
          <ResponsiveDialogFooter>
            <Button className="w-full" onClick={() => setSheetOpen(false)}>
              完成
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}

export { FilterBar, type FilterBarProps }

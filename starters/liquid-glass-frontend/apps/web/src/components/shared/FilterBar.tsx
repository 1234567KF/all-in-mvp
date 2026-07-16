/**
 * FilterBar — 筛选栏布局容器
 *
 * 来源：参考 frontend/src/pages/MemberManagement.tsx toolbar 区域
 * 及 frontend/src/pages/AuditLogs.tsx 筛选栏区域
 *
 * 结构：flex 水平排列 + wrap + gap，接受任意子元素
 * 可选：传入 labels 数组为每个子元素添加标签包裹
 * 可选：useFormField=true 时使用 FormField 结构包裹（需要外层提供 FormProvider）
 */

import * as React from "react"

import { FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FilterBarProps {
  /** 筛选栏子元素（Select、Input、Button 等） */
  children: React.ReactNode
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
}

function FilterBar({
  children,
  className,
  labels,
  useFormField = false,
}: FilterBarProps) {
  const hasLabels = labels && labels.length > 0
  const childArray = React.Children.toArray(children)

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {hasLabels
        ? childArray.map((child, i) => {
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
        : children}
    </div>
  )
}

export { FilterBar, type FilterBarProps }

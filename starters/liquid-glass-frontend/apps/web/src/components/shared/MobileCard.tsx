import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * MobileCard — 移动端（<md）列表卡片内容组合原语
 *
 * 提供标准三段式布局原语（MobileCardHeader / MobileCardBody / MobileCardFooter），
 * 兼顾向下兼容的简单行布局（MobileCardTitle / MobileCardTags / MobileCardMeta）。
 */

/** 根容器：默认 space-y-1.5 统一垂直间距 */
function MobileCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1.5", className)} {...props} />
}

interface MobileCardHeaderProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** 标题文本，左侧自动截断 truncate */
  title: React.ReactNode
  /** 右侧固定对齐的徽章/状态插槽 */
  extra?: React.ReactNode
}

/** 顶部标题行：左侧 Title 自动 truncate，右侧 Extra 徽章固顶对齐 */
function MobileCardHeader({
  title,
  extra,
  children,
  className,
  ...props
}: MobileCardHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      <div
        className="min-w-0 flex-1 truncate text-sm font-medium"
        style={{ color: "var(--lg-text-primary)" }}
      >
        {title}
      </div>
      {(extra || children) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {extra}
          {children}
        </div>
      )}
    </div>
  )
}

/** 主体业务属性区：规范字号 text-xs 与默认间距 space-y-1 */
function MobileCardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("space-y-1 text-xs", className)}
      style={{ color: "var(--lg-text-secondary)" }}
      {...props}
    />
  )
}

interface MobileCardFooterProps extends React.ComponentProps<"div"> {
  /** 左侧辅助属性/标签 (例如分类 tag) */
  left?: React.ReactNode
  /** 右侧动作按钮组 (例如 编辑、删除) */
  actions?: React.ReactNode
}

/** 底部操作栏：左侧辅助信息，右侧自动阻止冒泡的动作组 */
function MobileCardFooter({
  left,
  actions,
  children,
  className,
  ...props
}: MobileCardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 text-xs",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{left}</div>
      {(actions || children) && (
        <div
          className="flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
          {children}
        </div>
      )}
    </div>
  )
}

// ── 向下兼容旧组件 ──
interface MobileCardTitleProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  title: React.ReactNode
}

function MobileCardTitle({
  title,
  className,
  children,
  ...props
}: MobileCardTitleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <span
        className="truncate text-sm font-medium"
        style={{ color: "var(--lg-text-primary)" }}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

function MobileCardTags({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

function MobileCardMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 font-mono text-[11px]", className)}
      style={{ color: "var(--lg-text-muted)" }}
      {...props}
    />
  )
}

interface MobileCardCompactProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** 标题文本 */
  title: React.ReactNode
  /** 次要描述/标签组/价格 (单行或多属性自适应) */
  description?: React.ReactNode
  /** 状态 Badge 等插槽 (右上角/右侧) */
  extra?: React.ReactNode
  /** 动作按钮组 (自动阻止冒泡) */
  actions?: React.ReactNode
}

/**
 * MobileCardCompact — 极简紧凑单行/双行原语
 * 专门用于主数据（分类、字典）、拖拽排序列表等轻量级场景。
 * 行高 40px~56px，无分割线，一屏可看 7~10 条，拖拽极度流畅。
 */
function MobileCardCompact({
  title,
  description,
  extra,
  actions,
  className,
  ...props
}: MobileCardCompactProps) {
  return (
    <div className={cn("space-y-1 py-0.5", className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <div
          className="min-w-0 flex-1 truncate text-sm font-medium"
          style={{ color: "var(--lg-text-primary)" }}
        >
          {title}
        </div>
        {(extra || (!description && actions)) && (
          <div className="flex shrink-0 items-center gap-2">
            {extra}
            {!description && actions && (
              <div onClick={(e) => e.stopPropagation()}>{actions}</div>
            )}
          </div>
        )}
      </div>

      {description && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
            style={{ color: "var(--lg-text-secondary)" }}
          >
            {description}
          </div>
          {actions && (
            <div
              className="flex shrink-0 items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export {
  MobileCard,
  MobileCardBody,
  MobileCardCompact,
  MobileCardFooter,
  MobileCardHeader,
  MobileCardMeta,
  MobileCardTags,
  MobileCardTitle,
}

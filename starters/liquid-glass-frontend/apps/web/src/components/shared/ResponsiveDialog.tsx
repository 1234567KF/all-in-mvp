/**
 * ResponsiveDialog — 响应式弹窗原语
 *
 * 桌面（≥md）：居中 Dialog；移动（<md）：底部 Sheet（顶部圆角、内容区独立滚动、Footer 吸底）。
 * API 与 Dialog 家族一一对应，存量弹窗可机械替换：
 *   Dialog → ResponsiveDialog，DialogContent → ResponsiveDialogContent，以此类推。
 *
 * 注意：
 * - Sheet 与 Dialog 底层同为 radix Dialog primitive，Header/Title/Description/Close
 *   直接复用 Dialog 家族实现，仅 Root/Content/Footer 需要分叉。
 * - className 中的 sm:max-w-* 等宽度约束仅作用于桌面分支；移动分支恒为全宽底部抽屉。
 * - 单树渲染：同一时刻只挂载 Dialog 或 Sheet 一棵树。
 */
import { XIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

/** 供子组件读取当前分支，避免重复调用 useIsMobile */
const ResponsiveDialogContext = React.createContext(false)

function ResponsiveDialog(props: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile()
  return (
    <ResponsiveDialogContext.Provider value={isMobile}>
      {isMobile ? <Sheet {...props} /> : <Dialog {...props} />}
    </ResponsiveDialogContext.Provider>
  )
}

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  showCloseButton?: boolean
}) {
  const isMobile = React.useContext(ResponsiveDialogContext)

  // Sheet 与遮罩均让出底部 TabBar（与侧边抽屉同范式）；
  // inline 覆盖基类 data-[side=bottom]:bottom-0 / inset-0（特异性压过 utilities）
  const tabbarOffset =
    "calc(var(--tabbar-height) + env(safe-area-inset-bottom))"

  if (!isMobile) {
    return (
      <DialogContent
        className={className}
        showCloseButton={showCloseButton}
        {...props}
      >
        {children}
      </DialogContent>
    )
  }

  return (
    <SheetContent
      side="bottom"
      showCloseButton={false}
      // 有 Footer 时去掉滚动容器底部 padding：sticky 元素钉住时无法越出
      // 父容器 content box，pb-6 会在 Footer 下方漏出 24px 透出内容的缝隙
      className="max-h-[80dvh] gap-0 rounded-t-2xl bg-popover p-0 [&>div:has([data-slot=dialog-footer])]:pb-0"
      style={{ bottom: tabbarOffset }}
      overlayStyle={{ bottom: tabbarOffset }}
      {...props}
    >
      {/* 内容区独立滚动；Footer 通过 sticky 吸底 */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-4 md:gap-4 md:p-6">
        {children}
      </div>
      {showCloseButton && (
        <SheetClose asChild>
          {/* 定位元素禁用 .touch-hit（其 position:relative 无层级恒胜 utilities 的 absolute），
              用 after: 伪元素扩命中区（icon-sm 28px + inset 16px = 44px）；pointer-coarse 门控与 ui/dialog、ui/sheet 对齐 */}
          <Button
            variant="ghost"
            className="absolute top-3 right-3 rounded-full pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']"
            size="icon-sm"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </SheetClose>
      )}
    </SheetContent>
  )
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = React.useContext(ResponsiveDialogContext)
  return (
    <DialogFooter
      className={cn(
        isMobile &&
          // mb-0 取消基类 -mb-6 出血（滚动容器已对 Footer 场景 pb-0，无 padding 可吃）
          "sticky bottom-0 z-10 mb-0 rounded-b-none bg-popover/95 backdrop-blur-md",
        className
      )}
      {...props}
    />
  )
}

// Header/Title/Description/Close/Trigger 两分支行为一致，直接复用 Dialog 家族
const ResponsiveDialogHeader = DialogHeader
const ResponsiveDialogTitle = DialogTitle
const ResponsiveDialogDescription = DialogDescription
const ResponsiveDialogClose = DialogClose
const ResponsiveDialogTrigger = DialogTrigger

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
}

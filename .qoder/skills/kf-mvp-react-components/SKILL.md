---
name: kf-mvp-react-components
description: >-
  Load when user asks for React component development, component patterns, or
  React 19 best practices with shadcn/ui and Liquid Glass. Triggers: React组件,
  react开发, component patterns, react19, hooks, 组件模式, shadcn, 组合式组件.
  Also load when building reusable UI components or React development patterns.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
  based_on: starters/liquid-glass-frontend
  design_system: Liquid Glass
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-frontend-dev
      type: semantic
    - target: all-in-mvp
      type: semantic
---

# MVP React Components — React 组件模式

> **Core Belief**: Components are contracts. Small, typed, composable, and visually consistent with Liquid Glass.
> **权威源**: `starters/liquid-glass-frontend/` — React 19 + shadcn/ui (radix-nova) + Tailwind 4 + Liquid Glass。

**Division of Labor**: This Skill focuses on **React component patterns**. Page-level development lives in `kf-mvp-frontend-dev`; this skill covers reusable component design.

---

## Default Tech Stack

- Framework: React 19.2+ (Hooks)
- UI: shadcn/ui (`components.json` style `radix-nova`)
- CSS: Tailwind CSS 4 + `--lg-*` tokens
- Variants: `class-variance-authority` (CVA)
- Class merge: `clsx` + `tailwind-merge` (`cn()` in `lib/utils.ts`)
- Icons: `lucide-react`
- Forms: `react-hook-form` + `zod`

---

## 1. Component Location

| 类型 | 目录 | 规则 |
|------|------|------|
| shadcn/ui 基础件 | `src/components/ui/` | 由 `shadcn add` 生成，只做必要定制 |
| 业务共享组件 | `src/components/shared/` | DataTable / FilterBar / ConfirmDialog / PageSkeleton |
| 模块私有组件 | `src/components/<module>/` | 仅本模块使用 |

> 禁止在 `pages/` 内堆叠可复用组件；先抽到 `components/`。

---

## 2. Component Template (React 19)

```tsx
// src/components/shared/StatCard.tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: ReactNode
  hint?: string
  className?: string
}

export function StatCard({ title, value, hint, className }: StatCardProps) {
  return (
    <div className={cn("glass-card rounded-[12px] p-6", className)}>
      <p className="font-body text-sm" style={{ color: "var(--lg-text-secondary)" }}>
        {title}
      </p>
      <p className="font-mono text-2xl font-semibold" style={{ color: "var(--lg-text-primary)" }}>
        {value}
      </p>
      {hint ? (
        <p className="font-body text-xs" style={{ color: "var(--lg-text-muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
```

**React 19 约定**：

- 不再需要 `forwardRef`；`ref` 作为普通 prop 传递
- 组件返回类型可省略（TS 自动推断）
- 使用函数声明 + 具名导出，便于 tree-shaking 与测试

---

## 3. Compound Components (组合式)

```tsx
// src/components/ui/panel.tsx
import type { ReactNode } from "react"

interface PanelProps {
  children: ReactNode
}

function PanelRoot({ children }: PanelProps) {
  return <section className="glass-card rounded-[12px] p-6">{children}</section>
}

function PanelHeader({ children }: PanelProps) {
  return <header className="mb-4 flex items-center justify-between">{children}</header>
}

function PanelBody({ children }: PanelProps) {
  return <div className="space-y-4">{children}</div>
}

export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Body: PanelBody,
})
```

用法：`<Panel><Panel.Header>...</Panel.Header><Panel.Body>...</Panel.Body></Panel>`

---

## 4. Variants with CVA

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badge = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 font-body text-xs",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--lg-surface-container)] text-[var(--lg-text-secondary)]",
        success: "bg-[var(--lg-success)]/15 text-[var(--lg-success)]",
        danger: "bg-[var(--lg-danger)]/15 text-[var(--lg-danger)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badge>

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
```

> 语义色 MUST 用 `--lg-*`，禁止 `text-red-500` / `bg-green-600`。

---

## 5. Controlled / Uncontrolled

```tsx
interface SearchInputProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}

export function SearchInput({ value, defaultValue, onChange }: SearchInputProps) {
  const [inner, setInner] = useState(defaultValue ?? "")
  const isControlled = value !== undefined
  const current = isControlled ? value : inner

  function handleChange(next: string) {
    if (!isControlled) setInner(next)
    onChange?.(next)
  }

  return (
    <input
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-[8px] bg-background/40 backdrop-blur-[12px] ..."
    />
  )
}
```

---

## 6. shadcn/ui 使用规则

- 新增组件：`bunx shadcn@latest add <component>`（不要手写一份）
- 修改 `components/ui/*` 时，先确认 CSS 变体不影响其他调用方（R021）
- `DialogTitle` MUST 带图标
- 表单字段用 `Field` / `FieldLabel`，不要手写 label 结构
- 日期范围用 `date-range-picker`，不要原生 date input

---

## 7. Liquid Glass 组件规范

| 类别 | 规范 |
|------|------|
| 卡片 | `rounded-[12px]` + `.glass-card`/`.matte-card`，禁止 `rounded-lg` |
| 按钮 | 主按钮 `className="btn-primary"`；次按钮 ghost |
| 输入框 | `rounded-[8px]`，`bg-background/40 backdrop-blur-[12px]`，focus 用 Qoder Green |
| 标题 | `font-heading` / `font-h2`，颜色 `var(--lg-text-primary)` |
| 数据 | `font-mono`（JetBrains Mono），KPI 左侧 2px Liquid 强调线 |
| 弹层 | 必须 `backdrop-blur-[12px]` |
| 图标 | `lucide-react`，尺寸 `size-4`，颜色用 `var(--lg-info)` 等语义变量 |

---

## 8. Hooks 模式

```tsx
// 数据获取：错误必须可见（R015）
export function useAsyncData<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fn()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
```

> 禁止 `.catch(() => {})`；错误必须 `setError` 或 `showError`。

---

## 9. Testing

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="客户数" value={128} />)
    expect(screen.getByText("客户数")).toBeInTheDocument()
    expect(screen.getByText("128")).toBeInTheDocument()
  })
})
```

覆盖：渲染、props 变化、交互、空/加载/错误态、受控/非受控切换。

---

## Constraints

**MUST:**

- 类型完整，禁止 `any`
- 所有颜色/字体/圆角走 Liquid Glass token
- 可复用组件抽到 `components/shared/`
- 组件测试覆盖渲染 + 交互 + 状态
- 修改共享组件后跑 `bun run arch:check` + `check-liquid-glass-style.ps1`

**MUST NOT:**

- 硬编码 hex/rgba 或 Tailwind 原始色类
- 在组件内直接 `import api/axios/sonner`
- 用 `rounded-lg` 做卡片圆角
- 复制 shadcn/ui 源码手改后不同步调用方

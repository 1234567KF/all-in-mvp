---
name: kf-mvp-frontend-dev
description: >-
  Load when user asks to develop frontend, create React components, or build pages
  with mock API. Triggers: 前端开发, react, 页面开发, frontend, 组件开发,
  前端, create page, build UI. NOT for: backend development, database design,
  or API contract design.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
  based_on: starters/liquid-glass-frontend
  design_system: Liquid Glass
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-mock-service
      type: sequential
    - target: kf-mvp-arch-expert
      type: semantic
    - target: kf-mvp-playwright-infra
      type: semantic
    - target: all-in-mvp
      type: semantic
---

# MVP Frontend Developer — 前端开发技能

> **Core Belief**: Frontend should never wait for backend. Build against mock, swap for real API when ready. Component by component, page by page.
> **权威源**: `starters/liquid-glass-frontend/` — React 19 + Vite 8 + Tailwind 4 + shadcn/ui (radix-nova) + Liquid Glass 设计体系。

**Division of Labor**: This Skill focuses on **React component development** with mock API integration. It outputs pages, components, and hooks. Network access is isolated in `src/services/`.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Framework: React 19 (Hooks)
- Build: Vite 8.x
- State: Zustand 5.x
- Routing: React Router 7.x
- HTTP: Axios 1.x (encapsulated in `src/lib/api.ts`)
- UI: shadcn/ui (radix-nova) + Tailwind CSS 4
- Design System: **Liquid Glass** (see `DESIGN.md`)

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Mock-first** — Build against mock server, swap API later
2. **Component-based** — Reusable components, clean architecture
3. **Hooks** — React 19 Hooks throughout
4. **TypeScript** — Full type safety
5. **UI locked** — shadcn/ui + Liquid Glass, never mix frameworks

---

# Tech Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | React | 19.2+ | Hooks |
| Build | Vite | 8.x | |
| Language | TypeScript | 6.0+ | `noUnusedLocals` + `noUnusedParameters` |
| State | Zustand | 5.x | `persist` middleware |
| Routing | React Router | 7.x | `viewTransition` |
| HTTP | Axios | 1.x | Only inside `src/lib/api.ts` |
| UI | shadcn/ui | latest | `components.json` style `radix-nova` |
| CSS | Tailwind CSS | 4.2+ | `@tailwindcss/vite` |
| Icons | lucide-react | latest | |
| Toast | `@/lib/toast` | — | Wraps sonner; never import sonner directly |

**MUST NOT mix UI frameworks** within the same project.

---

# 架构分层（AGENTS.md 强制 — gate R022-R025）

```
pages/ + components/   UI 层 —— 只调用 services/，禁止直连 api/axios/fetch
        ↓
services/              网络层 —— 唯一可 import { api } from "@/lib/api" 的地方
        ↓
lib/api.ts             Axios 实例 + 401 刷新队列
        ↓
Hono API               统一 ok/fail 响应
```

**四条硬约束**：

1. UI 层（`components/`、`pages/`）禁止 `import { api } from "@/lib/api"`
2. UI 层禁止 `import axios` / 裸 `fetch`
3. 除 `lib/toast.ts` 与 `App.tsx`（Toaster）外，禁止 `import "sonner"`
4. 页面必须 `React.lazy()` 引入（LoginPage 除外）

> 对应门禁脚本：`.qoder/scripts/check-liquid-glass-style.ps1`（R022-R025）

---

# Project Structure

```
apps/web/src/
├── App.tsx                 # Routes + React.lazy + Toaster
├── main.tsx
├── router/
│   └── ProtectedRoute.tsx
├── stores/                 # Zustand
│   ├── auth.ts
│   └── [module].ts
├── services/               # 网络层
│   └── [module].ts
├── pages/                  # 页面（必须 lazy）
│   ├── [Module]ListPage.tsx
│   ├── [Module]DetailPage.tsx
│   └── LoginPage.tsx
├── components/
│   ├── ui/                 # shadcn/ui（button/dialog/select/table/field...）
│   └── shared/             # DataTable/FilterBar/ConfirmDialog/PageSkeleton...
├── layouts/
│   └── SidebarLayout.tsx
├── lib/
│   ├── api.ts              # Axios 实例（唯一）
│   ├── toast.ts            # showSuccess/showError/showWarning/showInfo
│   ├── menu-config.ts      # 侧边栏 + ⌘K 索引
│   └── utils.ts
├── theme-tokens.css        # --lg-* 设计变量
└── design-utils.css        # .glass-card / .matte-card / .liquid-card
```

---

# Stage 0: Project Initialization（跳过此步 = 复盘问题 E）

**MUST 先检查 Coordinator 是否已初始化好前端项目目录。** 如果尚未初始化：

```bash
# 步骤 1: 扫描脚手架（P0 强制性）
ls starters/liquid-glass-frontend/

# 步骤 2: 脚手架存在 → 直接复制（推荐）
cp -r starters/liquid-glass-frontend/ frontend/
cd frontend && bun install

# 步骤 3: 仅当脚手架确实不存在 → 手动创建
bun create vite@latest frontend -- --template react-ts
cd frontend
bun install tailwindcss @tailwindcss/vite tw-animate-css
# 然后复制 .qoder/skills/references/liquid-glass/ 三件套
```

> **红线**：发现 `starters/liquid-glass-frontend/` 存在却仍 `bun create vite` → P0 错误。脚手架含完整路由/布局/主题/设计体系/shared 组件，从零创建会丢失所有预设。

**验证初始化完成**：

- [ ] `bun run dev` 可正常启动
- [ ] 访问 `http://localhost:5173` 可见首页
- [ ] `@/` 路径别名生效
- [ ] CSS 变量 `--lg-background` 等可用
- [ ] `bun run arch:check` 通过

---

# Stage 1: Service Layer（网络层唯一入口）

> **禁止在 UI 层直接调用 api/axios。** 所有网络逻辑封装在 `src/services/`，返回 Promise。

```typescript
// src/services/[module].ts
import { api } from "@/lib/api"

export interface [Module]Item {
  id: number
  name: string
}

export interface [Module]ListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface [Module]ListResponse {
  list: [Module]Item[]
  total: number
}

export async function fetch[Module]List(
  params?: [Module]ListParams
): Promise<[Module]ListResponse> {
  const res = await api.get("/[module]", { params })
  return res.data.data
}

export async function fetch[Module]ById(id: number): Promise<[Module]Item> {
  const res = await api.get(`/[module]/${id}`)
  return res.data.data
}

export async function create[Module](
  data: Omit<[Module]Item, "id">
): Promise<[Module]Item> {
  const res = await api.post("/[module]", data)
  return res.data.data
}

export async function update[Module](
  id: number,
  data: Partial<Omit<[Module]Item, "id">>
): Promise<[Module]Item> {
  const res = await api.put(`/[module]/${id}`, data)
  return res.data.data
}

export async function delete[Module](id: number): Promise<void> {
  await api.delete(`/[module]/${id}`)
}
```

> `src/lib/api.ts` 已内置于脚手架：baseURL 读 `VITE_API_BASE_URL`（默认 `/api`），请求拦截器注入 Bearer token，401 自动刷新并重放请求。**不要再新建第二个 axios 实例。**

---

# Stage 2: React Hooks

```typescript
// src/hooks/use[Module].ts
import { useCallback, useEffect, useState } from "react"

import {
  create[Module],
  delete[Module],
  fetch[Module]List,
  update[Module],
  type [Module]Item,
  type [Module]ListParams,
} from "@/services/[module]"

export function use[Module]() {
  const [items, setItems] = useState<[Module]Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchList = useCallback(async (params?: [Module]ListParams) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetch[Module]List(params)
      setItems(data.list)
      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : "加载失败"
      setError(message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (data: Omit<[Module]Item, "id">) => {
    setLoading(true)
    setError(null)
    try {
      const created = await create[Module](data)
      setItems((prev) => [created, ...prev])
      return created
    } catch (e) {
      const message = e instanceof Error ? e.message : "创建失败"
      setError(message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback(
    async (id: number, data: Partial<Omit<[Module]Item, "id">>) => {
      setLoading(true)
      setError(null)
      try {
        const updated = await update[Module](id, data)
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
        return updated
      } catch (e) {
        const message = e instanceof Error ? e.message : "更新失败"
        setError(message)
        throw e
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const remove = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      await delete[Module](id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (e) {
      const message = e instanceof Error ? e.message : "删除失败"
      setError(message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 首屏加载；错误已由组件层 toast 呈现
    fetchList().catch(() => {})
  }, [fetchList])

  return { items, loading, error, fetchList, create, update, remove }
}
```

> `.catch(() => {})` 仅限“已在 hook 内 `setError`”的场景；UI 层捕获后 MUST `showError`（gate R015）。

---

# Stage 3: Component Development

## 页面骨架（列表页）

```tsx
// src/pages/[Module]ListPage.tsx
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable } from "@/components/shared/DataTable"
import { FilterBar } from "@/components/shared/FilterBar"
import { Input } from "@/components/ui/input"
import { use[Module] } from "@/hooks/use[Module]"
import { showError, showSuccess } from "@/lib/toast"

export default function [Module]ListPage() {
  const { items, loading, remove } = use[Module]()
  const [keyword, setKeyword] = useState("")

  async function handleDelete(id: number) {
    try {
      await remove(id)
      showSuccess("删除成功")
    } catch (e) {
      showError(e instanceof Error ? e.message : "删除失败")
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-h2" style={{ color: "var(--lg-text-primary)" }}>
          [模块名称]
        </h1>
        <Button className="btn-primary">新建</Button>
      </header>

      <Card className="glass-card p-6">
        <DataTable
          data={items}
          loading={loading}
          columns={[
            { key: "id", title: "ID" },
            { key: "name", title: "名称" },
          ]}
          toolbar={
            <FilterBar>
              <Input
                placeholder="搜索"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </FilterBar>
          }
          onDelete={handleDelete}
        />
      </Card>
    </div>
  )
}
```

## 表单弹窗（Dialog）

```tsx
// src/components/[module]/[Module]FormDialog.tsx
import { useState } from "react"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { showError, showSuccess } from "@/lib/toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string }) => Promise<void>
}

export function [Module]FormDialog({ open, onOpenChange, onSubmit }: Props) {
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit({ name })
      showSuccess("保存成功")
      onOpenChange(false)
    } catch (e) {
      showError(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--lg-surface-low)]/95 backdrop-blur-[12px]">
        <DialogHeader>
          {/* R021/DESIGN.md：DialogTitle 必须带图标 */}
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" style={{ color: "var(--lg-info)" }} />
            新建[模块]
          </DialogTitle>
        </DialogHeader>

        <Field>
          <FieldLabel style={{ color: "var(--lg-text-secondary)" }}>
            名称
          </FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background/40 backdrop-blur-[12px]"
          />
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "提交中..." : "提交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## 共享组件优先（禁止重复造轮子）

| 场景 | 使用 |
|------|------|
| 数据表格 | `components/shared/DataTable` |
| 1000+ 行 | `components/shared/VirtualDataTable` |
| 筛选工具栏 | `components/shared/FilterBar`（放进 `DataTable` 的 `toolbar`） |
| 确认弹窗 | `components/shared/ConfirmDialog` |
| 文件上传 | `components/shared/FileUpload` |
| 加载骨架 | `components/shared/PageSkeleton` / `TableSkeleton` |
| ⌘K 搜索 | `components/shared/CommandPalette` |

> 日期范围选择 MUST 用 `components/ui/date-range-picker`，禁止原生 `<input type="date">` 或两个独立输入框。

---

# Stage 4: Router Setup

```tsx
// src/App.tsx
import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"

import PageSkeleton from "@/components/shared/PageSkeleton"
import SidebarLayout from "@/layouts/SidebarLayout"
import LoginPage from "@/pages/LoginPage"
import ProtectedRoute from "@/router/ProtectedRoute"

// 所有页面必须 React.lazy（LoginPage 除外）
const [Module]ListPage = lazy(() => import("@/pages/[Module]ListPage"))

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<SidebarLayout />}>
            <Route
              path="/[module]"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <[Module]ListPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  )
}
```

**新增页面三件套**：页面文件 → `App.tsx` lazy 注册 → `lib/menu-config.ts` 的 `menuGroups` 增加条目（`title` / `path` / `icon` / `keywords` / `englishSub`）。

---

# Stage 5: Component Interaction Testing（MUST）

**工具**：Vitest 4 + `@testing-library/react` 16 + `@testing-library/user-event`

```typescript
// src/components/[module]/[Module]FormDialog.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { [Module]FormDialog } from "./[Module]FormDialog"

describe("[Module]FormDialog", () => {
  it("提交时调用 onSubmit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <[Module]FormDialog open onOpenChange={() => {}} onSubmit={onSubmit} />
    )

    await user.type(screen.getByLabelText("名称"), "测试")
    await user.click(screen.getByRole("button", { name: "提交" }))

    expect(onSubmit).toHaveBeenCalledWith({ name: "测试" })
  })

  it("提交失败时展示 toast 且不关闭弹窗", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn().mockRejectedValue(new Error("boom"))

    render(
      <[Module]FormDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    )

    await user.click(screen.getByRole("button", { name: "提交" }))

    // 错误已由 showError 呈现；弹窗不得关闭
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
```

## 覆盖率要求

| 测试类型 | 最低数量 | 说明 |
|---------|---------|------|
| 渲染测试 | 每个组件 | props 变化、空状态、加载态 |
| 交互测试 | 每个可交互元素 | 点击、输入、选择、提交 |
| 状态同步 | 每个 store 关联 | Zustand 变更同步 |
| 表单验证 | 每个表单 | 必填、格式、长度、异步校验 |

---

# Liquid Glass 风格强制（v2.20 — 对齐脚手架）

> 生成任何 UI 前先读 `DESIGN.md`。以下是高频规则，完整规范以脚手架为准。

## 颜色

- MUST 用 `--lg-*` 变量或 Tailwind theme 映射（`bg-background`、`text-foreground`、`border-border`）
- MUST NOT 硬编码 `#22c55e`、`rgba(...)`、`text-red-500`、`bg-red-600`
- 语义色：错误用 `variant="destructive"` 或 `var(--lg-danger)`；信息用 `var(--lg-info)`

## 字体

| 用途 | 类 | 变量 |
|------|----|------|
| 标题 | `font-heading` / `font-h2` | `--font-heading` (Manrope) |
| 正文 | `font-body` | `--font-body` (Inter) |
| 数据/KPI | `font-mono` | `--font-mono` (JetBrains Mono) |

## 容器与玻璃拟态

- 卡片：`12px` 圆角（`rounded-[12px]` 或 `var(--lg-radius-lg)`），**禁止** `rounded-lg`
- 玻璃卡片：`.glass-card` / `.liquid-card` / `.matte-card`（`design-utils.css`）
- 弹层/弹窗/下拉：`backdrop-filter: blur(12px)` 必须存在
- 间距：4px 基线（`p-6` = 24px 卡片内边距，`gap-4` = 16px 卡片间距）

## 结构约定

- 页面标题：`className="font-h2"` + `style={{ color: "var(--lg-text-primary)" }}`，**不带图标**
- 弹窗标题：`DialogTitle` **必须带图标**
- 表格筛选：全部塞进 `DataTable` 的 `toolbar` + `FilterBar`
- 日期范围：用 `date-range-picker`，禁止原生 date input

---

# Quality Checklist

- [ ] 所有网络调用经 `services/`（UI 层无 `@/lib/api` / axios / fetch）
- [ ] 所有页面 `React.lazy()` + `Suspense`（LoginPage 除外）
- [ ] toast 经 `@/lib/toast`（无直接 `import "sonner"`）
- [ ] Loading / Error / Empty 三态处理
- [ ] 表单校验实现
- [ ] TypeScript 类型完整，无未使用变量/导入
- [ ] 颜色/字体/圆角符合 Liquid Glass（无硬编码色值）
- [ ] 组件测试覆盖渲染 + 交互 + 状态 + 生命周期
- [ ] `bun run arch:check` 通过

---

# Constraints

**MUST DO:**

- Use mock API URL in development
- Handle loading and error states
- Use Hooks only (no class components)
- Type all props and emits
- Write computed style assertions for every page/component with visible UI
- Generate visual regression baselines for key pages and states
- Run full visual verification suite before marking DONE
- Mark VISUAL_PENDING when layout/CSS is modified (do NOT self-mark DONE)
- **D-09 前端一致性**：使用 starters/ 脚手架时，开发产物必须覆盖/替换脚手架源码，或删除 starters/。确保用户浏览器访问的前端 == E2E 验证的前端

**MUST NOT DO:**

- Use any type without reason
- Hardcode API URLs (use env vars)
- Skip loading states
- Use `var` instead of `const`/`let`
- Hardcode colors or use Tailwind raw color classes
- Import `api` / `axios` / `sonner` directly in UI components
- Self-mark DONE after CSS/layout changes without human visual review
- Skip visual test execution and claim "looks fine"

---

## Gotchas

- **Mock URL** — 在 `.env.development` 设置 `VITE_API_BASE_URL`
- **Auth token** — accessToken 仅内存，refreshToken 存 sessionStorage（脚手架 `stores/auth.ts`）
- **Response envelope** — 统一 `{ success, data, message }`；service 层返回 `res.data.data`
- **Error handling** — service 抛错，UI 捕获后 `showError`，禁止空 `.catch(() => {})`
- **UI lock-in** — 一旦选定 shadcn/ui，所有组件 MUST 用它，禁止混用 Ant Design 组件
- **默认栈** — 未指定时用 shadcn/ui + Liquid Glass
- **MVP exemptions** — No SSR, no PWA, no complex state hydration. Keep it simple.
- **Axios** — 只用 `src/lib/api.ts` 的单例；禁止再 `axios.create()`
- **Visual verification is MANDATORY** — `toBeVisible()` 不够，关键页面必须有 computed style 断言 + 截图基线
- **VISUAL_PENDING → DONE** — 改 CSS/布局 → 标 VISUAL_PENDING，不自行 DONE
- **🇨🇳 中文编码规范** — placeholder/label 等 HTML 属性值禁止使用 U+201C/U+201D，一律用 ASCII 双引号 `"`；Write 后 `grep -rnP '[\x{fffd}]' <file>` 自检

---

# 前端三层测试（FT1-FT3）

| 层级 | 测试类型 | 工具 | 覆盖目标 |
|------|---------|------|---------|
| **FT1** | 组件单元测试 | Vitest + @testing-library/react | 渲染、props、事件、hook |
| **FT2** | 页面交互测试 | Vitest + @testing-library/react + Mock API | 表单、状态、路由、API 调用 |
| **FT3** | 端到端流程测试 | Playwright | 完整用户旅程、跨页面、真实浏览器 |

```text
src/__tests__/
├── components/      # FT1
├── pages/           # FT2
└── e2e/             # FT3
```

---

# Mock 连接与验证规则

## 环境变量

```env
# .env.development
VITE_API_BASE_URL=http://localhost:3000

# .env.production
VITE_API_BASE_URL=/api
```

## Mock 持续验证

```json
{
  "scripts": {
    "mock:sync": "node scripts/verify-mock-contract.ts",
    "dev": "bun run mock:sync && vite"
  }
}
```

> Mock drift 超过 24h → 前端标记 BLOCKED，等待 Mock 同步。

---

# 视觉自验证协议（Visual Self-Verification Protocol）

> **核心问题**：LLM 不能"看到"渲染结果。`toBeVisible()` 只检查元素存在于 DOM，不检查 CSS 布局/颜色/遮挡。三道自动化防线，全部确定性可验证。

> **Playwright 基础设施**：配置、截图基线、浏览器实例池、storageState 复用由 `kf-mvp-playwright-infra` 管理。

## 防线 1：Computed Style 断言（每个页面）

```typescript
// tests/visual/<page>.visual.spec.ts
import { expect, test } from "@playwright/test"

test.describe("Dashboard Page — Visual Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")
  })

  test("primary button follows Liquid Glass tokens", async ({ page }) => {
    const btn = page.locator(".btn-primary").first()
    // Dark 默认主题 Qoder Green #22c55e = rgb(34, 197, 94)
    await expect(btn).toHaveCSS("background-color", "rgb(34, 197, 94)")
    const radius = await btn.evaluate(
      (el) => getComputedStyle(el).borderRadius
    )
    expect(radius).not.toBe("0px")
  })

  test("glass card has 12px radius and blur", async ({ page }) => {
    const card = page.locator(".glass-card").first()
    await expect(card).toHaveCSS("border-radius", "12px")
    const backdrop = await card.evaluate(
      (el) => getComputedStyle(el).backdropFilter
    )
    expect(backdrop).toContain("blur(12px)")
  })

  test("page header layout", async ({ page }) => {
    const header = page.locator("header").first()
    await expect(header).toHaveCSS("display", "flex")
    const box = await header.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(56)
  })
})
```

**必覆盖的 computed style 维度**：

| 类别 | 关键属性 | 场景 |
|------|---------|------|
| 颜色 | `background-color`、`color`、`border-color` | 按钮、标签、告警、状态 |
| 尺寸 | `width`、`height`、`min-height` | 容器、卡片、图片 |
| 间距 | `padding`、`margin`、`gap` | 列表、网格、表单组 |
| 排版 | `font-size`、`font-weight`、`line-height` | 标题、正文、标签 |
| 布局 | `display`、`flex-direction`、`justify-content` | 页面框架、工具栏 |
| 定位 | `position`、`z-index` | 弹窗、下拉、固定导航 |
| 边框 | `border-radius`、`border-width` | 卡片（12px）、按钮、输入框 |

## 防线 2：视觉回归快照

```typescript
test("dashboard main view", async ({ page }) => {
  await page.goto("/dashboard")
  await page.waitForLoadState("networkidle")
  await expect(page).toHaveScreenshot("dashboard-main.png", {
    maxDiffPixels: 100,
  })
})
```

```bash
# 首次生成基线（本地有头）
bunx playwright test --project=chromium-headed --update-snapshots
# CI 对比
bunx playwright test --project=chromium-headless
```

## 防线 3：DOM 结构快照（A11y Tree）

```typescript
test("dashboard a11y structure", async ({ page }) => {
  await page.goto("/dashboard")
  await page.waitForLoadState("networkidle")
  const snapshot = await page.accessibility.snapshot()
  expect(snapshot).toMatchSnapshot("dashboard-a11y-tree.json")
})
```

## 开发完成即执行（Agent 强制流程）

```text
1. 启动 dev server
2. 运行 computed style 断言 → 全部 PASS
3. 运行视觉回归快照 → 首次生成基线，后续对比
4. 运行布局重叠检查 → 无重叠
5. 视觉验证报告写入 DONE 文件 visual_verification 字段
```

## VISUAL_PENDING 状态

| 变更类型 | 状态 | 解除条件 |
|---------|------|---------|
| 修改 .css / 布局结构 | VISUAL_PENDING | 人类审核截图 |
| 新增/修改动画/过渡 | VISUAL_PENDING | 人类审核截图 |
| 纯逻辑修复（hook/service/store） | 可自标 DONE | computed style 断言通过 |
| 纯文案修改 | 可自标 DONE | computed style 断言通过 |

```yaml
# VISUAL_PENDING 文件模板
module: dashboard
agent: frontend-dev-1
status: VISUAL_PENDING
reason: "CSS layout changed"
screenshots:
  before: "screenshots/dashboard-before.png"
  after: "screenshots/dashboard-after.png"
  diff: "screenshots/dashboard-diff.png"
computed_style_checks_passed: true
visual_regression_passed: false
review_url: "http://localhost:5173/dashboard"
human_action: "请打开 review_url 确认视觉效果，无误后删除此文件并创建 DONE"
```

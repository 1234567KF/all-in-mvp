# 🟢 Liquid Glass Design System — all-in-mvp 默认设计体系

> **适用范围**: 所有 all-in-mvp 流水线生成的前端项目
> **UI 框架**: Vue 3 + Vite + Tailwind CSS v4 + shadcn/vue
> **源设计**: [Liquid Glass Starter](http://192.168.110.2/starters/liquid-glass-starter)
> **默认主色**: Qoder 绿 `#22c55e` / `#4be277`
> **源文件**: `.qoder/skills/references/liquid-glass/` (theme-tokens.css, design-utils.css, index.css)

---

## 1. 设计理念

"Liquid Glass"（毛玻璃拟态）是一种强调**深度、透明度和光折射**的视觉语言：
- **Atmospheric Precision** — 通透、宽敞、技术精确
- **Glassmorphism** — `backdrop-filter: blur()` + 半透明背景
- **双主题** — Dark 为默认，Light 同样完整
- **CSS 变量驱动** — 改一处全局生效，无需动组件代码
- **主题一致性** — Dark/Light 切换只改颜色和透明度，布局/排版/间距/圆角绝对一致

---

## 2. 文件结构 (生成项目中的 src/)

```
src/
├── index.css              ← 入口: 引入 tailwind + tokens + utils
├── theme-tokens.css       ← ★ 核心: 全部 CSS 变量 (Dark/Light)
├── design-utils.css       ← 工具类: .glass-card .btn-primary 等
├── assets/fonts/          ← 字体文件 (Manrope/Inter/JetBrains Mono)
│   └── fonts.css
├── lib/
│   └── utils.ts           ← cn() 工具函数 (clsx + tailwind-merge)
└── components/
    └── ui/                ← shadcn/vue 组件
```

---

## 3. 颜色系统速查

### Dark Theme (默认 `:root`)

| Token | 值 | 用途 |
|-------|-----|------|
| `--background` | `#0e0e11` | 页面基础背景 |
| `--foreground` | `#e4e1e6` | 默认文字色 |
| `--card` | `rgba(27,27,30,0.7)` | 卡片背景 |
| `--primary` | `#22c55e` | ★ 主色 |
| `--primary-foreground` | `#000000` | 主色上文字 |
| `--secondary` | `#571bc1` | 次要色 |
| `--muted` | `#1f1f22` | 柔和背景 |
| `--border` | `rgba(61,74,61,0.4)` | 边框 |
| `--ring` | `rgba(75,226,119,0.5)` | 聚焦环 |
| `--radius` | `0.75rem` | 基础圆角 |

### Light Theme (`.light`)

| Token | 值 | 用途 |
|-------|-----|------|
| `--background` | `#f7f9fb` | 页面基础背景 |
| `--foreground` | `#191c1e` | 默认文字色 |
| `--card` | `rgba(255,255,255,0.7)` | 卡片背景 |
| `--primary` | `#006e2f` | ★ 主色 (Light) |
| `--primary-foreground` | `#ffffff` | 主色上文字 |
| `--secondary` | `#565e74` | 次要色 |
| `--muted` | `#f2f4f6` | 柔和背景 |
| `--border` | `rgba(109,123,108,0.3)` | 边框 |
| `--ring` | `rgba(0,110,47,0.5)` | 聚焦环 |

### Liquid Glass 专属 Token (`--lg-*`)

#### 表面层级

| Token | Dark | Light | 用途 |
|-------|------|-------|------|
| `--lg-surface-glass` | `rgba(27,27,30,0.7)` | `rgba(255,255,255,0.7)` | ★ 毛玻璃表面 |
| `--lg-surface-container` | `#1f1f22` | `#eceef0` | 容器表面 |
| `--lg-surface-high` | `#2a2a2d` | `#e6e8ea` | 高层级容器 |

#### 主色系

| Token | Dark | Light | 用途 |
|-------|------|-------|------|
| `--lg-primary` | `#22c55e` | `#006e2f` | ★ 主色 |
| `--lg-primary-light` | `#4be277` | `#22c55e` | 主色浅变 |
| `--lg-primary-glow` | `rgba(34,197,94,0.4)` | `rgba(0,110,47,0.3)` | 主色辉光 |
| `--lg-primary-hover` | `#4be277` | `#16a34a` | 主色悬停 |

#### 强调色

| Token | Dark | Light | 色系 |
|-------|------|-------|------|
| `--lg-accent-blue` | `#36b6fb` | `#005ac2` | 蓝色 |
| `--lg-accent-red` | `#ef4444` | `#ba1a1a` | 红色 |
| `--lg-accent-purple` | `#a855f7` | `#571bc1` | 紫色 |
| `--lg-accent-yellow` | `#eab308` | `#eab308` | 黄色 |

#### 文字层级

| Token | Dark | Light | 用途 |
|-------|------|-------|------|
| `--lg-text-primary` | `#e4e1e6` | `#191c1e` | 主要文字 |
| `--lg-text-secondary` | `#bccbb9` | `#3d4a3d` | 次要文字 |
| `--lg-text-muted` | `#869585` | `#6d7b6c` | 弱化文字 |
| `--lg-danger` | `#ffb4ab` | `#ba1a1a` | 危险/错误 |

---

## 4. 排版体系 (三字体系统)

| Token | 字体 | 用途 |
|-------|------|------|
| `--font-heading` | **Manrope** | 标题/Heading |
| `--font-body` | **Inter** | 正文/Body |
| `--font-mono` | **JetBrains Mono** | 代码/数据/KPI |

| 规格 | 字体 | 大小 | 字重 | 行高 |
|------|------|------|------|------|
| H1 | Manrope | 36px | 700 | 1.2 |
| H2 | Manrope | 24px | 600 | 1.3 |
| Body | Inter | 14px | 400 | 1.5 |
| Data Display | JetBrains Mono | 28px | 600 | 1 |
| Label Mono | JetBrains Mono | 11px | 500 | 0.05em |

---

## 5. 间距 & 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `--spacing-page` | `32px` (移动端 `16px`) | 页面外边距 |
| `--spacing-card` | `24px` | 卡片内边距 |
| `--spacing-element` | `16px` | 元素间距 |
| `--radius` (Tailwind) | `0.75rem` | 基础圆角 |
| `--radius-glass-sm` | `8px` | 按钮/输入框 |
| `--radius-glass-md` | `12px` | ★ 卡片 (必须 12px) |
| `--radius-glass-lg` | `16px` | 大面板 |

---

## 6. 工具类速查 (design-utils.css)

| Class | 用途 |
|-------|------|
| `.glass-card` | ★ 毛玻璃卡片 (带阴影) |
| `.liquid-glass` | 毛玻璃容器 (无阴影) |
| `.matte-card` | 平板毛玻璃 (无反光渐变) |
| `.glass-row` | 表格行 (hover 左侧主色条) |
| `.btn-primary` | 主色按钮 |
| `.btn-secondary` | 次要按钮 (幽灵玻璃) |
| `.glass-input` | 毛玻璃输入框 |
| `.skeleton-glass` | 骨架屏加载 |
| `.section-title` | 章节标题 |
| `.data-label` | 等宽大写标签 |
| `.font-h1` / `.font-h2` | 标题字体 |
| `.font-data-display` | 数据展示大字体 |
| `.chart-container` | 图表容器 |

---

## 7. 组件规范

### 卡片 (Card)

- 1px 边框 + 12px 圆角 (`--radius-glass-md`) + 顶部光泽渐变
- **Dark**: `bg-[#1b1b1e]/70` + `backdrop-blur-md` + `rgba(255,255,255,0.03)` 顶部渐变
- **Light**: `bg-[#ffffff]/70` + `backdrop-blur-md` + `rgba(0,0,0,0.03)` 顶部渐变
- 模板: `<div class="glass-card p-6">`

### 主色按钮 (Primary Button)

- **Dark**: 实色 `#22c55e`，黑字，hover → `#4be277` + 主色 glow
- **Light**: 实色 `#006e2f`，白字，hover → `#16a34a` + 柔和绿影
- 模板: `<button class="btn-primary">` 或 `<Button variant="default">`

### 次要按钮 (Secondary Button)

- 幽灵玻璃风格: 1px 边框 + 半透明背景 + hover 加深
- 模板: `<button class="btn-secondary">` 或 `<Button variant="secondary">`

### 输入框 (Input)

- 8px 圆角，毛玻璃背景 (`--radius-glass-sm`)
- Dark focus: 边框 `#4be277` + `rgba(34,197,94,0.3)` glow
- Light focus: 边框 `#006e2f` + `rgba(0,110,47,0.2)` glow
- 模板: `<input class="glass-input" />`

### KPI 指标 (KPI)

- 数值**必须**使用 JetBrains Mono 字体
- 左侧 2px 主色竖条 + 辉光: `<div class="kpi-accent">`

---

## 8. 预设主题色切换

搜索 `★★★` 标记快速定位变量组。替换 `:root` 和 `.light` 中的对应变量：

| 色系 | `--primary` | `--lg-primary-light` |
|------|-------------|---------------------|
| 绿色 **(默认)** | `#22c55e` | `#4be277` |
| 蓝色 | `#3b82f6` | `#60a5fa` |
| 紫色 | `#8b5cf6` | `#a78bfa` |
| 橙色 | `#f97316` | `#fb923c` |

切换时需同步更新：`--ring`, `--chart-*`, `--sidebar-*`, `--shadow-*`, `--lg-*` (全部主色相关变量)。

---

## 9. DO's and DON'Ts

### ✅ DO
- 使用 CSS 变量 (`var(--primary)`, `var(--lg-surface-glass)`) 或工具类 (`.glass-card`)
- 使用三字体系统: Manrope (标题) / Inter (正文) / JetBrains Mono (数据)
- 卡片圆角固定 12px (`--radius-glass-md`)
- KPI 数值必须用 `font-mono` / JetBrains Mono
- 弹窗/浮层必须加 `backdrop-filter: blur(12px)`
- 支持 Dark/Light 双主题

### ❌ DON'T
- **不要**在组件中硬编码 hex/rgba 颜色值
- **不要**使用 Tailwind 默认圆角类 (如 `rounded-lg` 是 8px)，应使用 `rounded-[12px]` 或 CSS 变量
- **不要**省略弹窗/浮层上的 `backdrop-filter`
- **不要**在 KPI 数值上使用 Inter/Manrope 字体

---

## 10. 快速接入 (3 步)

### 步骤 1: 初始化

```bash
npm create vite@latest my-app -- --template vue-ts
cd my-app
npm install tailwindcss @tailwindcss/vite tw-animate-css
npx shadcn-vue@latest init
```

### 步骤 2: 复制设计系统文件

```bash
# 从 .qoder/skills/references/liquid-glass/ 复制到 src/
cp .qoder/skills/references/liquid-glass/theme-tokens.css src/
cp .qoder/skills/references/liquid-glass/design-utils.css src/
cp .qoder/skills/references/liquid-glass/index.css src/
```

### 步骤 3: 引入并启动

在 `main.ts` 中:
```ts
import './index.css'
```

```bash
npm install clsx tailwind-merge lucide-vue-next class-variance-authority reka-ui vue-router
npm run dev
```

---

## 11. AI Agent 使用指南

> **此节供 all-in-mvp 流水线中的所有 Agent 使用。** 当生成 Vue 3 前端代码时：

1. **先读此文档** — 对齐 Liquid Glass 核心视觉原则，而非普通 shadcn 灰白风格
2. **使用 CSS 变量引用颜色** — 永远不要硬编码 hex/rgba
3. **优先使用共享工具类** — `.glass-card` `.liquid-glass` `.glass-row` `.btn-primary` `.btn-secondary` `.glass-input` 等
4. **强制排版变量** — Manrope 标题 / Inter 正文 / JetBrains Mono 数据
5. **KPI 数据展示** — 数值必须用 `font-mono`，卡片必须用 12px 圆角
6. **Dark 优先** — `:root` 定义 Dark 主题，`.light` 类覆盖 Light 主题
7. **源文件参考** — 设计系统源文件位于 `.qoder/skills/references/liquid-glass/`

# Liquid Glass Design System — 完整设计规范

> **适配**: Vue 3 + Vite + Tailwind CSS v4 + shadcn/vue
> **源设计**: Liquid Glass Starter (http://192.168.110.2/starters/liquid-glass-starter)
> **默认主色**: Qoder 绿 `#22c55e` / `#4be277`

---

## 1. 设计理念

"Liquid Glass"（毛玻璃拟态）是一种强调**深度、透明度和光折射**的视觉语言。核心体验：
- **Atmospheric Precision** — 通透、宽敞、技术精确
- **Glassmorphism** — `backdrop-filter: blur()` + 半透明背景
- **双主题** — Dark 为默认，Light 同样完整
- **CSS 变量驱动** — 改一处全局生效，无需动组件代码
- **主题一致性** — Dark/Light 切换只改颜色和透明度，布局/排版/间距/圆角绝对一致

---

## 2. 文件结构 (脚手架目录)

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

## 3. 完整 Design Token 速查表

### 3.1 颜色系统

#### Dark Theme (默认 `:root`)

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

#### Light Theme (`.light`)

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

### 3.2 Liquid Glass 专属 Token (`--lg-*`)

#### 表面层级

| Token | Dark | Light | 用途 |
|-------|------|-------|------|
| `--lg-background` | `#0e0e11` | `#ffffff` | 最底层背景 |
| `--lg-surface` | `#131316` | `#f7f9fb` | 表面 |
| `--lg-surface-glass` | `rgba(27,27,30,0.7)` | `rgba(255,255,255,0.7)` | ★ 毛玻璃表面 |
| `--lg-surface-low` | `#1b1b1e` | `#f2f4f6` | 低层级容器 |
| `--lg-surface-container` | `#1f1f22` | `#eceef0` | 容器表面 |
| `--lg-surface-high` | `#2a2a2d` | `#e6e8ea` | 高层级容器 |
| `--lg-surface-highest` | `#353438` | `#e0e3e5` | 最高层级 |

#### 主色系

| Token | Dark | Light | 用途 |
|-------|------|-------|------|
| `--lg-primary` | `#22c55e` | `#006e2f` | ★ 主色 |
| `--lg-primary-light` | `#4be277` | `#22c55e` | 主色浅变 |
| `--lg-primary-dim` | `rgba(34,197,94,0.15)` | `rgba(34,197,94,0.08)` | 主色淡化背景 |
| `--lg-primary-glow` | `rgba(34,197,94,0.4)` | `rgba(0,110,47,0.3)` | 主色辉光 |
| `--lg-primary-border` | `rgba(34,197,94,0.3)` | `rgba(0,110,47,0.2)` | 主色边框 |
| `--lg-primary-hover` | `#4be277` | `#16a34a` | 主色悬停 |
| `--lg-on-primary` | `#003915` | `#ffffff` | 主色上文字 |
| `--lg-on-primary-container` | `#004b1e` | `#004b1e` | 主色容器上文字 |

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
| `--lg-warning` | `#facc15` | `#eab308` | 警告 |
| `--lg-info` | `#8bcfff` | `#005ac2` | 信息 |

### 3.3 排版 Token

| Token | 字体 | 大小 | 字重 | 用途 |
|-------|------|------|------|------|
| `--font-heading` | Manrope | — | — | 标题字体 |
| `--font-body` | Inter | — | — | 正文字体 |
| `--font-mono` | JetBrains Mono | — | — | 代码/数据字体 |

**排版规格表：**

| 规格 | 字体 | 大小 | 字重 | 行高 | 字间距 |
|------|------|------|------|------|--------|
| Display LG | Manrope | 48px | 700 | 56px | -0.02em |
| Headline LG | Manrope | 32px | 600 | 40px | -0.01em |
| Headline MD | Manrope | 24px | 600 | 32px | — |
| Body LG | Inter | 18px | 400 | 28px | — |
| Body MD | Inter | 16px | 400 | 24px | — |
| Label MD | JetBrains Mono | 14px | 500 | 20px | 0.02em |
| H1 | Manrope | 36px | 700 | 1.2 | -0.02em |
| H2 | Manrope | 24px | 600 | 1.3 | -0.01em |
| Body Main | Inter | 14px | 400 | 1.5 | — |
| Data Display | JetBrains Mono | 28px | 600 | 1 | — |
| Label Mono | JetBrains Mono | 11px | 500 | — | 0.05em |

### 3.4 间距 Token (4px 基线网格)

| Token | 值 | 用途 |
|-------|-----|------|
| `--spacing-page` | `32px` (移动端 `16px`) | 页面外边距 |
| `--spacing-card` | `24px` | 卡片内边距 |
| `--spacing-element` | `16px` | 元素间距 |

### 3.5 圆角 Token

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius` (Tailwind) | `0.75rem` | 基础圆角 |
| `--radius-glass-sm` | `8px` | 按钮/输入框 |
| `--radius-glass-md` | `12px` | ★ 卡片 (必须 12px) |
| `--radius-glass-lg` | `16px` | 大面板 |
| `--radius-glass-xl` | `20px` | 超大面板 |

### 3.6 阴影 & 特效 Token

| Token | Dark 值 | Light 值 | 用途 |
|-------|----------|----------|------|
| `--glass-blur` | `12px` | `12px` | 标准毛玻璃模糊 |
| `--glass-blur-heavy` | `20px` | `20px` | 重度毛玻璃模糊 |
| `--shadow-card` | `0 4px 24px rgba(0,0,0,0.3)` | `0 4px 24px rgba(0,0,0,0.06)` | 卡片阴影 |
| `--shadow-glow-primary` | `0 0 8px rgba(34,197,94,0.4)` | `0 0 8px rgba(0,110,47,0.3)` | 主色辉光 |
| `--shadow-glow-soft` | `0 0 20px rgba(34,197,94,0.1)` | `0 0 20px rgba(0,110,47,0.08)` | 柔和辉光 |

---

## 4. 工具类速查 (design-utils.css)

| Class | 用途 |
|-------|------|
| `.glass-card` | ★ 毛玻璃卡片 (带阴影) |
| `.liquid-card` | 毛玻璃卡片 (无阴影) |
| `.liquid-glass` | 毛玻璃容器 (无阴影) |
| `.matte-card` | 平板毛玻璃 (无反光渐变) |
| `.glass-row` | 表格行 (hover 左侧主色条) |
| `.kpi-accent` | KPI 左侧发光竖条 |
| `.liquid-accent` | 普通左侧竖条 |
| `.btn-primary` | 主色按钮 |
| `.btn-secondary` | 次要按钮 (幽灵玻璃) |
| `.glass-input` | 毛玻璃输入框 |
| `.badge-active` | 激活状态徽章 |
| `.badge-inactive` | 未激活徽章 |
| `.tag-green` / `.tag-blue` / `.tag-purple` / `.tag-red` | 彩色标签 |
| `.skeleton-glass` | 骨架屏加载 |
| `.section-title` | 章节标题 |
| `.data-label` | 等宽大写标签 |
| `.font-h1` / `.font-h2` | 标题字体 |
| `.font-data-display` | 数据展示大字体 |
| `.chart-container` | 图表容器 |
| `.animate-blob` | 浮动 blob 动画 |

---

## 5. 深度与层级规范

### Dark Mode (环境辉光)

| Level | 背景 | 模糊 | 边框 | 用途 |
|-------|------|------|------|------|
| 0 (Base) | `#0e0e11` | — | — | 页面背景 |
| 1 (Cards) | `rgba(27,27,30,0.7)` | `blur(12px)` | `1px rgba(61,74,61,0.4)` | 卡片/行 |
| 2 (Overlay) | `rgba(27,27,30,0.95)` | `blur(12px)` | + 主色 glow | 弹窗/下拉 |

### Light Mode (色调遮蔽)

| Level | 背景 | 模糊 | 边框 | 用途 |
|-------|------|------|------|------|
| 0 (Base) | `#f7f9fb` | — | — | 页面背景 |
| 1 (Cards) | `rgba(255,255,255,0.7)` | `blur(12px)` | `1px rgba(109,123,108,0.3)` | 卡片/行 |
| 2 (Overlay) | `rgba(255,255,255,0.95)` | `blur(12px)` | 柔和阴影 | 弹窗/下拉 |

---

## 6. 组件规范

### 卡片

- 1px 边框 + 12px 圆角 + 顶部光泽渐变
- Dark: `bg-[#1b1b1e]/70` + `backdrop-blur-md` + `rgba(255,255,255,0.03)` 顶部渐变
- Light: `bg-[#ffffff]/70` + `backdrop-blur-md` + `rgba(0,0,0,0.03)` 顶部渐变

### 主色按钮

- Dark: 实色 `#22c55e`，黑字，hover → `#4be277` + 主色 glow
- Light: 实色 `#006e2f`，白字，hover → `#16a34a` + 柔和绿影

### 次要按钮

- 幽灵玻璃风格: 1px 边框 + 半透明背景 + hover 加深

### 输入框

- 8px 圆角，毛玻璃背景
- Dark focus: 边框 `#4be277` + `rgba(34,197,94,0.3)` glow
- Light focus: 边框 `#006e2f` + `rgba(0,110,47,0.2)` glow

### KPI 指标

- 数值必须使用 **JetBrains Mono** 字体
- 左侧 2px 主色竖条 + 辉光

---

## 7. 预设主题色切换

搜索 `★★★` 标记快速定位变量组。替换 `:root` 和 `.light` 中的对应变量：

| 色系 | `--primary` | `--lg-primary-light` |
|------|-------------|---------------------|
| 绿色 (默认) | `#22c55e` | `#4be277` |
| 蓝色 | `#3b82f6` | `#60a5fa` |
| 紫色 | `#8b5cf6` | `#a78bfa` |
| 橙色 | `#f97316` | `#fb923c` |
| 青色 | `#06b6d4` | `#22d3ee` |
| 玫红 | `#ec4899` | `#f472b6` |

切换时需同步更新：`--ring`, `--chart-*`, `--sidebar-*`, `--shadow-*`, `--lg-*` (全部主色相关变量)。

---

## 8. DO's and DON'Ts (约束与反模式)

- ✅ **DO** 使用 CSS 变量 (如 `var(--primary)`, `var(--lg-surface)`) 或工具类 (如 `.glass-card`)
- ✅ **DO** 使用三字体系统: Manrope (标题) / Inter (正文) / JetBrains Mono (数据)
- ✅ **DO** 卡片圆角固定 12px (`--radius-glass-md`)
- ❌ **DON'T** 在 Vue 组件中硬编码 hex/rgba 颜色值
- ❌ **DON'T** 使用 Tailwind 默认圆角类 (如 `rounded-lg` 是 8px)，应使用 `rounded-[12px]` 或 CSS 变量
- ❌ **DON'T** 在弹窗/浮层上省略 `backdrop-filter: blur(12px)`

---

## 9. 快速接入 (3 步)

### 步骤 1: 使用预设脚手架（推荐）

```bash
# 直接复制 starter 脚手架（已含 Vite + Tailwind v4 + shadcn + 设计体系全部 CSS）
cp -r starters/liquid-glass-frontend/ my-app/
cd my-app
npm install
npm run dev
```

> **为什么不用 `npm create vite`？** 脚手架已预配置好 280+ CSS 变量、25+ 工具类、主题系统、路由骨架、AppLayout、KpiCard 组件。从零搭反而要重新做这些。

### 步骤 1b: 手动初始化（仅当脚手架不可用时）

```bash
# 仅在 starters/ 目录不存在时使用此方式
npm create vite@latest my-app -- --template vue-ts
cd my-app

# 安装 Tailwind CSS v4 + 动画 + shadcn/vue
npm install tailwindcss @tailwindcss/vite tw-animate-css
npx shadcn-vue@latest init
```

### 步骤 2: 复制设计系统文件

```bash
cp skills/references/liquid-glass/theme-tokens.css src/
cp skills/references/liquid-glass/design-utils.css src/
cp skills/references/liquid-glass/index.css src/
```

### 步骤 3: 安装依赖并启动

```bash
npm install clsx tailwind-merge lucide-vue-next class-variance-authority reka-ui vue-router
npm install date-fns v-calendar recharts
npm run dev
```

在 `main.ts` 中引入样式：
```ts
import './index.css'
```

在 `App.vue` 中包裹 ThemeProvider（使用 shadcn/vue 的 ColorMode 方案）：
```vue
<script setup lang="ts">
// shadcn/vue 主题切换通过 useColorMode 或手动切换 .dark class
</script>
```

---

## 10. AI Agent 使用指南

作为 AI 编码助手，在为本脚手架生成 Vue 组件时：

1. **先读此文档** — 对齐 Liquid Glass 核心视觉原则
2. **间接引用 Token** — 使用 `theme-tokens.css` 中的 CSS 变量或 Tailwind v4 映射类
3. **优先使用共享工具类** — 在写自定义容器样式前，先检查 `.glass-card` `.liquid-card` `.matte-card` `.glass-row` 是否满足需求
4. **强制排版变量** — 使用 `font-heading` `font-body` `font-mono` 工具类
5. **数据展示** — KPI 数值必须用 `font-mono`，卡片必须用 12px 圆角

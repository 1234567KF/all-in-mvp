# Liquid Glass Starter Design System

<!-- region:template-only -->

[![Test Preview](https://img.shields.io/badge/🌐_测试环境预览-192.168.110.214%3A11070-22c55e?style=for-the-badge)](http://192.168.110.214:11070)
<!-- endregion:template-only -->

一个轻量、精美的 Web UI 启动模板，支持 Dark/Light 双主题与 6 套可运行时切换的主题色，通过 CSS 变量驱动，**改主色只需修改变量，无需动组件代码**。

![Dashboard Preview](docs/dashboard-preview.png)

### 🎨 设计系统规范 (Design System Specs)

本项目基于独特的 **Liquid Glass (毛玻璃拟态)** 视觉语言构建。详细的设计、色彩与排版规范请参阅唯一的 [设计系统规范 (DESIGN.md)](./DESIGN.md) 手册。

---

<!-- region:template-only -->

## Quick Start (AI-Native 脚手架创建)

本项目支持通过 **AI 技能 (Agent Skill)** 交互式地在本地生成新项目。无论是全栈 TS Monorepo 还是异构后端（Go/Kotlin 平铺目录），都支持一键重构与自动依赖安装。

### 1. 安装/更新 AI 技能

您可以通过 `npx giget` 命令，免去克隆整个仓库的开销，直接将脚手架技能下载并安装到对应 AI Agent 的全局配置目录中：

#### macOS / Linux / Git Bash / WSL (使用 `~`)

- **Qoder：**
  ```bash
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder ~/.qoder/skills/wecode-project-scaffolder --force
  ```
- **Qoder CN：**
  ```bash
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder ~/.qoder-cn/skills/wecode-project-scaffolder --force
  ```
- **Claude Code：**
  ```bash
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder ~/.claude/skills/wecode-project-scaffolder --force
  ```
- **Gemini / Antigravity：**
  ```bash
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder ~/.gemini/config/plugins/wecode-plugin/skills/wecode-project-scaffolder --force
  ```

#### Windows (PowerShell)

- **Qoder：**
  ```powershell
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "$HOME\.qoder\skills\wecode-project-scaffolder" --force
  ```
- **Qoder CN：**
  ```powershell
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "$HOME\.qoder-cn\skills\wecode-project-scaffolder" --force
  ```
- **Claude Code：**
  ```powershell
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "$HOME\.claude\skills\wecode-project-scaffolder" --force
  ```
- **Gemini / Antigravity：**
  ```powershell
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "$HOME\.gemini\config\plugins\wecode-plugin\skills\wecode-project-scaffolder" --force
  ```

#### Windows (CMD - 命令提示符)

- **Qoder：**
  ```cmd
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "%USERPROFILE%\.qoder\skills\wecode-project-scaffolder" --force
  ```
- **Qoder CN：**
  ```cmd
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "%USERPROFILE%\.qoder-cn\skills\wecode-project-scaffolder" --force
  ```
- **Claude Code：**
  ```cmd
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "%USERPROFILE%\.claude\skills\wecode-project-scaffolder" --force
  ```
- **Gemini / Antigravity：**
  ```cmd
  npx giget git:git@192.168.110.2:starters/liquid-glass-starter/skills/wecode-project-scaffolder "%USERPROFILE%\.gemini\config\plugins\wecode-plugin\skills\wecode-project-scaffolder" --force
  ```

> 💡 **提示**：若技能后续有更新，只需重新运行上述对应助手的命令即可完成覆盖升级。

### 2. 通过 AI 一键创建

在新目录中开启与 AI 助手的对话，发送以下任意指令激活技能：

- `用 Liquid Glass Starter 新建项目`
- `搭建脚手架`
- `scaffold project`

AI 助手将引导您完成交互式参数收集并自动在指定目录下完成项目生成。

---

## 备用方案：通过本地 CLI 脚本创建

如果不通过 AI 交互，您也可以在确保本地安装了 Bun 之后，直接通过命令行调用脚本：

```bash
bun run skills/wecode-project-scaffolder/scripts/scaffold.ts \
  --name "my-project-name" \
  --target "/absolute/path/to/my-project" \
  --type "monorepo" \ # 可选: monorepo | flat-go | flat-java (Kotlin)
  --clean-demo true   # 可选: true | false
```

---

<!-- endregion:template-only -->

## 项目结构 (Monorepo)

本项目采用 `Bun Workspaces` 管理的多工作区全栈结构：

```
├── apps/
│   ├── web/              # 前端子项目 (Vite + React SPA)
│   │   ├── src/          # 前端源代码
│   │   ├── public/       # 前端静态资源
│   │   ├── index.html    # 前端入口 HTML
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/              # 后端子项目 (Hono API 服务)
│       ├── src/          # 后端源代码
│       │   └── index.ts  # Hono 服务入口
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/           # 共享工具/校验包 (Zod Schema, TS 类型等)
│       ├── src/          # 共享代码
│       ├── tsconfig.json
│       └── package.json
├── package.json          # Monorepo 根配置 (定义 workspaces)
├── .prettierrc
├── .prettierignore
├── .gitignore
├── eslint.config.js
└── README.md
```

## 开箱即用

```bash
bun install
bun run dev
```

| 路由                        | 展示内容                                                       |
| --------------------------- | -------------------------------------------------------------- |
| `/login`                    | 毛玻璃背景 + blob 动画 + 表单 + 错误态 + loading               |
| `/dashboard`                | 仪表盘 Demo (KPI 卡片 + 柱状图 + 环形图 + 数据表格)            |
| `/components`               | 组件总览 (Utility Classes 展示)                                |
| `/components/foundations`   | 基础规范 (字体、间距、圆角、背景样式)                          |
| `/components/forms`         | 表单相关组件与表单域                                           |
| `/components/data`          | 数据交互组件 (表格、分页、筛选、骨架屏)                        |
| `/components/overlays`      | 浮层与导航组件 (Tabs, Dialog, Sheet, Alerts, Toast & TreeView) |
| `/components/notifications` | 消息通知组件 (Bell, NotificationPanel, NotificationCenter)     |
| `/virtual-table`            | 虚拟滚动大数据表格 Demo (10,000 行)                            |
| `/settings`                 | 个人设置页                                                     |
| `/system-settings`          | 系统设置页 (配置管理)                                          |
| `/403-demo`                 | 403 无权限页 Demo                                              |
| `/404-demo`                 | 404 页面 Demo                                                  |
| `/500-demo`                 | 500 服务异常页 Demo                                            |
| `/result-demo`              | 操作结果页 Demo                                                |
| `/*`                        | 404 Not Found 页面                                             |

---

## 快速接入（3 步）

### 1. 初始化项目环境

```bash
# 创建 Vite + React + TypeScript 项目
npm create vite@latest my-app -- --template react-ts
cd my-app

# 安装 Tailwind CSS v4 及其相关支持
npm install tailwindcss @tailwindcss/vite tw-animate-css

# 初始化 shadcn/ui（选择 neutral base color）
npx shadcn@latest init
```

### 2. 复制主题文件

将以下文件复制到新项目 `src/` 目录下：

```bash
cp apps/web/src/index.css apps/web/src/theme-tokens.css apps/web/src/design-utils.css your-project/src/
cp -r apps/web/src/components/* your-project/src/components/
cp -r apps/web/src/lib/* your-project/src/lib/
cp -r apps/web/src/assets/fonts your-project/src/assets/
```

在 `src/index.css` 中调整字体路径：

```css
/* 将 ./fonts/fonts.css 改为实际路径 */
@import "./assets/fonts/fonts.css";
```

### 3. 安装依赖

```bash
# 安装基础依赖与所有业务组件所需依赖
npm install clsx tailwind-merge lucide-react class-variance-authority radix-ui react-router-dom
npm install date-fns react-day-picker recharts cmdk zod
```

在 `App.tsx` 中包裹 ThemeProvider：

```tsx
import { ThemeProvider } from "./components/theme-provider"

function App() {
  return <ThemeProvider defaultTheme="system">{/* 你的应用 */}</ThemeProvider>
}
```

---

## 可用脚本 (Root Commands)

在项目根目录下可以运行以下命令管理所有子项目：

| 命令                   | 说明                                                      |
| ---------------------- | --------------------------------------------------------- |
| `bun run dev`          | 同时启动前端开发服务器 (5173端口) 和 Hono 后端 (3000端口) |
| `bun run dev:web`      | 单独启动前端开发服务器                                    |
| `bun run dev:api`      | 单独启动后端开发服务器                                    |
| `bun run build`        | 编译打包所有子模块（shared ➡️ api ➡️ web）                |
| `bun run build:shared` | 单独编译 shared 共享模块                                  |
| `bun run build:web`    | 单独编译前端静态包                                        |
| `bun run build:api`    | 单独编译后端 API 代码                                     |
| `bun run typecheck`    | 执行全局 TypeScript 类型检查                              |
| `bun run lint`         | ESLint（web + api + shared 三包，带 content cache；含后端架构约束）         |
| `bun run lint:fix`     | ESLint 自动修复（含 import 排序）                                 |
| `bun run test`         | 运行全部测试 (ESLint 规则 + shared + web + api)                   |
| `bun run test:eslint`  | 自定义 ESLint 规则的 RuleTester 测试                             |
| `bun run test:web`     | 运行前端 Vitest 单元测试                                          |
| `bun run test:api`     | 运行后端 Bun 单元测试                                             |
| `bun run test:shared`  | 运行共享包单元测试                                                |
| `bun run test:ci`      | CI 模式测试 (含覆盖率)                                            |
| `bun run arch:check`   | 架构依赖检查                                                      |

**数据库命令**（根目录运行；`bun --filter api <script>` 等价于进入 `apps/api` 执行，也可 `cd apps/api && bun run <script>`）：

| 命令                             | 说明                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| `bun --filter api db:generate`   | **生成项目**：修改 Schema 后生成迁移 SQL                             |
| `bun --filter api db:migrate`    | **生成项目**：把迁移应用到 SQLite（bun:sqlite 直连，无额外原生依赖） |
| `bun run db:reset`               | 重建本地数据库并播种（根目录脚本）                                   |
| `bun --filter api migrate:check` | 数据库预检（迁移 / 初始化脚本与 schema.ts 的结构一致性）             |

<!-- region:template-only -->

**模板仓库专属命令**（生成项目已删除 `init.sql`，不适用）：

| 命令                                | 说明                                      |
| ----------------------------------- | ----------------------------------------- |
| `bun --filter api db:init:generate` | 从 schema.ts 重新生成 `apps/api/init.sql` |
| `bun --filter api db:init:check`    | 校验 init.sql 与 schema.ts 是否一致       |

> 模板仓库禁止生成/应用迁移（`db:generate` / `db:migrate` 会被守卫拒绝），结构由 `init.sql` 重建。

<!-- endregion:template-only -->

---

### 自定义 ESLint 规则（`eslint-rules/`）

分工原则：**单文件 AST 可判定的走 ESLint，跨文件不变量才交给 `arch:check`**。

| 规则 id | 拦什么 | 生效范围 |
| ------- | ------ | -------- |
| `project-rules/no-toisostring-slice` | `.toISOString().slice(0,10)` 之类截断 UTC → UTC+ 时区日期倒退一天 | 全仓 `warn` |
| `project-rules/no-tailwind-raw-colors` | `className` 里的 Tailwind 原色类（`text-red-500` 等） | `pages/` `components/` = `error` |
| `project-rules/no-raw-viewport-check` | 直读 `window.innerWidth` 做窄屏分叉（应走 `useIsMobile()` / 断点类） | `pages/` `components/` = `error` |
| `project-rules/no-service-import-in-ui` | UI 层值导入 `@/services/*`（type-only 允许），服务端数据应走 Query hooks | `pages/` `components/` = `error` |
| `project-rules/no-audit-fn-without-opctx` | 直接写审计的导出 service 函数首参缺 `OpCtx` | `modules/**/*.service.ts` = `error` |

另有内置 `no-restricted-syntax` 承担两条后端约束：`modules/**/*.ts` 禁裸调 `writeLog(`，`*.route.ts` 默认禁手写 `hasPermission(`。

每条规则的 JSDoc 都写了 **Known blind spots** —— lint 绿不等于该类问题已绝迹，判据与盲区以规则文件为准。
豁免是棘轮式的：`reportUnusedDisableDirectives` 为 `error`，修完必须删掉 `eslint-disable`；
`eslint.config.js` 里的永久豁免块必须附"为什么无法满足 + 什么改动可以移除"两句话。

规则本身也有测试：`eslint-rules/*.test.js` 用 `RuleTester` 覆盖 valid / invalid 案例，跑 `bun run test:eslint`。
新增或收紧规则时先补一条会红的用例——本项目就是这么发现 `exec` 只报告首个匹配、改用 `matchAll` 才能报全一个属性里的多处违规。

---

## 核心组件使用示例

### 1. KPI 卡片 (`KpiCard`)

新封装的通用 KPI 卡片组件，集成毛玻璃、背景彩色发光光晕 (Blob)、左侧特色指示条与 Hover 呼吸发光特效：

```tsx
import { KpiCard } from "@/components/ui/kpi-card"
import { DollarSign } from "lucide-react"

;<KpiCard
  title="Monthly Revenue"
  value="$42.5K"
  icon={DollarSign}
  // primary：跟随主题色；green：固定语义成功绿；blue/red/purple/yellow：固定分类色
  accentColor="primary"
  trend={{ value: "+12.5%", direction: "up", label: "vs last month" }}
  loading={false}
/>
```

### 2. 日期范围选择器 (`DateRangePicker`)

集成 Popover 与日历的多月份选择组件：

```tsx
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { useState } from "react"
import { type DateRange } from "react-day-picker"

const [dateRange, setDateRange] = useState<DateRange | undefined>()

<DateRangePicker
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>
```

### 3. 消息通知 (`NotificationCenter`)

业务无关的消息中心组件：`NotificationBell` 只负责触发器与未读角标，`NotificationPanel` 只负责展示与回调，`NotificationCenter` 组合 Popover 并管理开合。组件不取数、不依赖路由，业务类型、文案高亮、跳转全部通过 props 注入。

组件消费的是 UI view model，wire schema 由 starter 内置的 [notification-adapter.ts](apps/web/src/lib/notification-adapter.ts) 统一映射（业务自定义路由可再包一层）：

```tsx
import { toNotificationItem } from "@/lib/notification-adapter"

// 后端 wire Notification → UI NotificationItem：isRead→read、createTime→createdAt、
// payload.href→href、其余 payload→meta。组件本身不感知后端字段。
const notifications = page.items.map(toNotificationItem)
```

`type` 是业务自定义的不透明字符串，前端通过注册表把它映射成图标/色调（后端内核不约束类型枚举）。

```tsx
import { NotificationCenter } from "@/components/shared/NotificationCenter"
import { CheckCircle2 } from "lucide-react"

;<NotificationCenter
  notifications={notifications} // NotificationItem[]：id/title/content/createdAt/read/type/href
  unreadCount={unreadCount}
  typeRegistry={{
    review_approved: { icon: CheckCircle2, tone: "success" },
  }}
  emphasis={[{ words: ["请及时审核", "待审核"], tone: "primary" }]}
  onMarkRead={(item) => markRead(item.id)}
  onMarkAllRead={markAllRead}
  onDelete={(item) => remove(item.id)}
  onItemClick={(item) => item.href && navigate(item.href)}
/>
```

说明：

- `content` 默认会把 `「…」` / `『…』` 包裹的文本渲染为实体 chip；正文含普通引号或需要完全自定义时传 `renderContent`。
- `emphasis` 是全局词表；需要按通知类型区分高亮时用 `renderContent`。
- 顶栏（[TopBar.tsx](apps/web/src/components/layout/TopBar.tsx)）已接真实 API：列表/未读数走 Query hooks，写操作走乐观更新 mutation，SSE 事件到达时自动刷新列表与角标。

完整状态矩阵（加载 / 空 / 错误 / 只读 / 长列表）与业务类型、自定义正文扩展示例见 `/components/notifications`（该页面用本地 demo 数据，方便调状态）。

### 4. 消息通知后端（业务无关内核）

消息相关业务可以直接复用，不必再写一套「建表 + 接口 + SSE + 未读状态」。内核只认五件事：**收件人 + 不透明 `type` + 标题/正文 + 业务 `payload` + 已读状态**；业务类型、文案、受众、跳转路由、图标色调全部留在业务侧。

| 层   | 文件                                                                                                                                                                                                                          | 职责                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 契约 | [packages/shared/src/notification.ts](packages/shared/src/notification.ts)                                                                                                                                                    | Zod schema（api / web 共用）、分页与未读数类型、SSE 事件名         |
| 内核 | [apps/api/src/shared/notification.ts](apps/api/src/shared/notification.ts)                                                                                                                                                    | `notify / notifyMany / notifySafe`；先落库后推送、`dedupeKey` 幂等 |
| 总线 | [apps/api/src/shared/notification-bus.ts](apps/api/src/shared/notification-bus.ts)                                                                                                                                            | 进程内 EventEmitter；多实例部署替换为 Redis pub/sub 即可           |
| HTTP | [apps/api/src/modules/notification/](apps/api/src/modules/notification/)                                                                                                                                                      | REST 端点 + SSE；收件人只从 JWT 取                                 |
| 前端 | [services/notifications.ts](apps/web/src/services/notifications.ts) · [useNotifications.ts](apps/web/src/hooks/queries/useNotifications.ts) · [useNotificationStream.ts](apps/web/src/hooks/queries/useNotificationStream.ts) | REST + fetch 流式 SSE，全部进 TanStack Query                       |

端点：

| 方法   | 路径                          | 说明                                                                        |
| ------ | ----------------------------- | --------------------------------------------------------------------------- |
| GET    | `/notifications`              | 游标分页 `?cursor=&limit=&unreadOnly=` → `{ items, nextCursor, hasMore }`   |
| GET    | `/notifications/unread-count` | `{ count }`                                                                 |
| POST   | `/notifications/:id/read`     | 单条已读（幂等）                                                            |
| POST   | `/notifications/read-all`     | 全部已读（可选 `?type=` 过滤）                                              |
| DELETE | `/notifications/:id`          | 删除（仅本人）                                                              |
| GET    | `/notifications/stream`       | SSE 实时推送，`Authorization: Bearer` 鉴权                                  |
| POST   | `/notifications/dev/push`     | demo-only 造数端点；仅 `NODE_ENV=development/test` 或 `DEMO_MODE=true` 可用 |
| POST   | `/notifications/dev/reset`    | demo-only 重置演示消息（恢复 7 条 / 4 未读），门禁同上                      |

业务侧只需在事件处调内核，然后交给现有 UI：

```ts
import { notifyMany } from "../../shared/notification.js"

// 审核提交 → 通知管理员
notifyMany(adminIds, {
  type: "review_submitted", // 不透明字符串，业务自由定义
  title: "新的待审申请",
  content: `「${customerName}」已提交，请及时审核`,
  payload: { href: `/reviews/${reviewId}`, relatedCode: reviewCode },
  dedupeKey: `review_submitted:${reviewId}`, // 幂等，重试不会重复推送
})
```

约定：

- `type` 不加枚举、不加 DB check：新增业务类型不需要迁移，也不需要改公共包。前端用 `typeRegistry` 把 type 映射为 icon/tone。
- `payload` 是业务扩展 JSON（`href` / 关联单号 / 发送人等），内核不解释；前端 adapter 把 `payload.href` 映射成 `NotificationItem.href`。
- 推送不变量是「先落库、再 publish」：断线重连后补拉不会丢消息；`notifySafe()` 用于「通知失败不影响主流程」的场景。
- 已读/删除不写审计（用户自有高频状态），边界理由见 `notification.service.ts` 头注释。
- 本仓库：`bun run db:reset` 后 admin 有 7 条演示消息；`POST /notifications/dev/push`（仅非生产）可手工验证 SSE 实时冒角标。
- **测试实例可重复演示**：`.env` 设置 `DEMO_MODE=true` 后，启动时若缺少演示消息会幂等补齐，且开放 `POST /notifications/dev/reset`（被点完/删完后一键恢复 4 未读/3 已读）。真实项目默认关闭，不产生任何业务耦合。
- 前端丢弃不符合 `NotificationSchema` 的 SSE 事件（契约漂移时只告警、不中断订阅）。

---

## 切换主题色

Demo 内置 6 套主题色，运行时即可切换：

- **顶栏 Palette 图标** → 快捷色板。
- **个人设置 → 外观主题 → 主题色** → 完整色板（带名称与当前值）。

选择会写入 `localStorage["theme-color"]`，并同步到 `<html data-theme-color="...">`；刷新后保持，多标签页同步。深浅模式各自有独立色阶，切换明暗不会丢失主题色。

| 主题色         | `data-theme-color` | Dark `primary` / `bright` | Light `primary` / `bright` |
| -------------- | ------------------ | ------------------------- | -------------------------- |
| 翡翠绿（默认） | `green`            | `#22c55e` / `#4be277`     | `#006e2f` / `#22c55e`      |
| 科技蓝         | `blue`             | `#3b82f6` / `#60a5fa`     | `#1d4ed8` / `#3b82f6`      |
| 星云紫         | `purple`           | `#8b5cf6` / `#a78bfa`     | `#6d28d9` / `#8b5cf6`      |
| 极光青         | `cyan`             | `#06b6d4` / `#22d3ee`     | `#0e7490` / `#06b6d4`      |
| 落日橙         | `orange`           | `#f97316` / `#fb923c`     | `#c2410c` / `#f97316`      |
| 玫瑰粉         | `rose`             | `#ec4899` / `#f472b6`     | `#be185d` / `#ec4899`      |

### 实现原理

- [theme-tokens.css](apps/web/src/theme-tokens.css) 的 `--theme-*-dark` / `--theme-*-light` 是主题色**种子**（共 11 个：primary-foreground-dark/light 是全局常量，每个预设只需覆盖其余 9 个）；`--primary`、`--lg-primary-*`、sidebar、ring、glow、chart-1/2 等 token 由种子派生（透明度用 `color-mix(in srgb, <seed> N%, transparent)`，与原来的 `rgba` 等价）。
- 文件末尾的 `:root[data-theme-color="blue"]` 预设块只覆盖种子；默认绿色不建块，回落到 `:root` 默认值。
- 语义状态色（success/active、danger、warning、info、`data-*` 调色盘）**不跟随主题色**；`--lg-success-*` 固定为绿色，避免蓝色主题下「启用」变成蓝色；浅底成功文字使用 `--lg-success-text`（light 为深绿），保证 12px 文字可读。
- 色板预览色是 `--theme-swatch-*`，选择器组件不硬编码颜色值。
- [index.html](apps/web/index.html) 有一段首屏前置脚本，在 React 挂载前应用 `theme` / `theme-color`，避免刷新闪色。它硬编码了默认 key（`theme` / `theme-color` / 默认 `green`）；若通过 `ThemeProvider` 的 `storageKey` / `themeColorStorageKey` / `defaultThemeColor` 改配置，需要同步修改这段脚本。
- 浏览器基线：依赖 `color-mix()`（Chrome 111+ / Safari 16.2+ / Firefox 113+，与 Tailwind v4 基线一致）。不支持时 Lightning CSS 的 fallback 会把半透明主色退化为不透明色，因此不承诺旧浏览器视觉一致。
- 主色/成功色文字都使用独立的 text token：`--lg-primary-text`（dark 用亮色阶、light 用深色阶）与 `--lg-success-text`（light 用深绿）；FormsPage 的 “Verify” 按钮、badge/tag/ResultCard/Alert 的绿色文字均已切换，浅色态 12px 文字不再只有约 2.3:1。

### 新增第 7 套主题色

1. 在 [theme-colors.ts](apps/web/src/lib/theme-colors.ts) 的 `THEME_COLORS` 中注册 id / 中文名（id 类型会自动派生）。
2. 在 `theme-tokens.css` 末尾照抄一个预设块，填写 9 个 preset 种子（Dark / Light 各一套；primary-foreground 两个常量无需重复）。
3. 在 `:root` 中补一条 `--theme-swatch-<id>` 预览色。
4. 运行 `bun run test:web`：测试会校验预设种子键集合完整、只覆盖 `--theme-*`、swatch 与主色一致，以及主色上的文字对比度 ≥ 4.5。

### 修改默认主色

直接改 `:root` 里的主题色种子（`--theme-primary-dark` / `--theme-bright-dark` / `--theme-primary-light` / `--theme-bright-light` 等）。不要直接改派生的 `--lg-primary-*`：它们由种子派生，改种子才能保证深浅模式与所有预设一致。若默认 id 仍是 `green`，记得同步 `--theme-swatch-green` 与该选项的中文名；测试会校验 swatch 与默认主色一致。

---

## 可用 Utility Classes

| Class                                                   | 用途                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `.glass-card`                                           | 毛玻璃卡片（带阴影，通常需要配合 `p-0 py-0 gap-0` 来放置表格等紧密布局） |
| `.liquid-card`                                          | 毛玻璃卡片（无阴影）                                                     |
| `.liquid-glass`                                         | 毛玻璃容器                                                               |
| `.glass-row`                                            | 表格行（hover 左侧主色条）                                               |
| `.kpi-accent`                                           | KPI 左侧发光竖条                                                         |
| `.liquid-accent`                                        | 普通左侧竖条                                                             |
| `.btn-primary`                                          | 主色按钮（高可读文字对比度）                                             |
| `.btn-secondary`                                        | 次要按钮                                                                 |
| `.glass-input`                                          | 毛玻璃输入框                                                             |
| `.badge-active`                                         | 激活状态徽章                                                             |
| `.badge-inactive`                                       | 未激活徽章                                                               |
| `.tag-green` / `.tag-blue` / `.tag-purple` / `.tag-red` | 彩色标签                                                                 |
| `.skeleton-glass`                                       | 骨架屏加载                                                               |
| `.section-title`                                        | 章节标题                                                                 |
| `.data-label`                                           | 等宽大写标签                                                             |
| `.font-h1` / `.font-h2`                                 | 标题字体                                                                 |
| `.font-data-display`                                    | 数据展示大字体                                                           |
| `.chart-container`                                      | 图表容器                                                                 |

---

## 快捷键

- **D 键**：切换 Dark/Light（theme-provider 内置）
- **⌘K / Ctrl+K**：需自行实现 Command Palette （展示 Demo 页面中已内置 Radix CommandDialog 触发）

---

## 依赖清单

| 包                                        | 用途                                |
| ----------------------------------------- | ----------------------------------- |
| `tailwindcss` (v4.2+)                     | 核心样式引擎                        |
| `@tailwindcss/vite`                       | Vite 插件                           |
| `tw-animate-css`                          | 精细动画插件                        |
| `shadcn`                                  | UI 辅助管理工具                     |
| `clsx` & `tailwind-merge`                 | 动态样式类安全合并                  |
| `lucide-react`                            | 图标库                              |
| `class-variance-authority` (cva)          | 组件状态多属性映射管理              |
| `radix-ui` / `react-router-dom`           | UI 底层原语与路由支持               |
| `date-fns` & `react-day-picker`           | 日历与日期范围选择支持              |
| `recharts`                                | Recharts 数据可视化渲染             |
| `cmdk`                                    | Radix 基础的 Command Palette 输入框 |
| `zod`                                     | 数据模式验证                        |
| `react-hook-form` + `@hookform/resolvers` | 表单状态管理与校验                  |
| `zustand`                                 | 轻量状态管理                        |
| `axios`                                   | HTTP 客户端                         |
| `@tanstack/react-virtual`                 | 大数据表格虚拟滚动                  |
| `sonner`                                  | Toast 通知组件                      |
| `vitest` + `happy-dom`                    | 单元测试框架                        |
| `husky` + `lint-staged`                   | Git Hooks 代码质量门禁              |
| `eslint-plugin-simple-import-sort`        | Import 自动排序                     |
| `eslint-plugin-jsx-a11y`                  | 无障碍检测                          |

---

## 工程化能力

| 能力            | 工具                                               |
| --------------- | -------------------------------------------------- |
| 代码分割        | React.lazy + Suspense + Vite manualChunks          |
| Pre-commit 检查 | Husky v9 + lint-staged (typecheck + lint + format) |
| Import 排序     | eslint-plugin-simple-import-sort (自动修复)        |
| 无障碍检测      | eslint-plugin-jsx-a11y (warn 级别)                 |
| 单元测试        | Vitest + happy-dom                                 |
| API 安全        | hono/secure-headers + CORS 白名单                  |
| 页面过渡        | View Transitions API (React Router DOM v7 原生)    |

---

## 设计特点

- **Glassmorphism**：backdrop-filter + 半透明背景
- **双主题**：Dark 为默认，Light 同样完整
- **6 套主题色**：翡翠绿 / 科技蓝 / 星云紫 / 极光青 / 落日橙 / 玫瑰粉，顶栏与个人设置均可切换
- **CSS 变量驱动**：所有颜色通过变量引用，改一处全局生效
- **三字体系统**：Manrope（标题）/ Inter（正文）/ JetBrains Mono（代码/数据）
- **辉光效果**：primary 色自带 glow shadow，增强视觉层次

---

## 切换其他语言后端 (Switching to Go/Kotlin)

如果您想在本项目中将 Node.js (Hono) 后端换成 **Go** 或 **Kotlin (Spring Boot)** 等其他语言，为了避免 JavaScript/Bun 工作区工具链对非 Node 后端开发造成干扰，**强烈建议摒弃原有的 JS Monorepo 物理结构，改用更自然的「平铺双目录」结构**。

以下是推荐的迁移与协作步骤：

### 1. 调整目录结构

将项目重构为前后端完全独立的平铺文件夹，让各自 of IDE 能够完美识别：

```
my-project/
├── frontend/             # 前端项目 (将 apps/web 移动至此并重命名)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/              # 后端项目 (新建并存放您的 Go/Kotlin 源码)
│   ├── go.mod / build.gradle.kts  # 后端依赖配置直接置于根目录
│   └── src/ (或 main.go)
├── Taskfile.yml          # [可选] 通用任务配置文件 (用于跨语言一键启动)
├── .gitignore
└── README.md
```

_重构后，请删除原根目录的 `package.json`、`bun.lock` 以及 `packages/shared` 目录，前端的 Node/Bun 依赖管理应全部收拢在 `/frontend` 目录内。_

### 2. (可选) 引入通用任务运行器 (Taskfile)

为了避免在根目录下残留冗余 of JS 依赖来调度后端命令，建议使用与语言无关的任务管理工具 **[Taskfile](https://taskfile.dev/)** 来管理跨语言任务。
在根目录新建 `Taskfile.yml`：

```yaml
version: "3"

tasks:
  dev:
    desc: 同时并发启动前端和后端开发服务器
    deps: [dev:frontend, dev:backend]

  dev:frontend:
    dir: frontend
    cmds:
      - bun run dev

  dev:backend:
    dir: backend
    cmds:
      - go run main.go # 如果是 Kotlin (Spring Boot) 改为: gradle bootRun
```

_系统安装 `task` CLI（如 macOS 执行 `brew install go-task`）后，在根目录直接运行 `task dev` 即可一键启动前后端。_

### 3. 微调前端代理端口

修改前端 [frontend/vite.config.ts](file:///frontend/vite.config.ts) 中的代理目标，使其指向 Go/Kotlin 后端的实际运行端口（例如 Spring Boot 默认的 `8080`）：

```typescript
server: {
  proxy: {
    "/api": {
      target: "http://localhost:8080", // ⬅️ 指向您的 Go 或 Kotlin 服务实际运行端口
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ""),
    },
  },
}
```

### 4. 使用 OpenAPI + 代码生成保持“类型安全”

在异构后端中，我们无法再直接共享 TypeScript 类型。推荐使用**契约驱动开发**：

1. **后端导出契约**：让 Go（利用 `swag` / `swaggo`）或 Kotlin（利用 `springdoc-openapi`）在编译/运行时自动生成标准的 OpenAPI (Swagger) `openapi.json` 规范文件。
2. **前端自动生成 SDK**：在前端目录下，通过配置 [Orval](https://orval.dev/) 或使用 `openapi-typescript` 命令行，拉取后端的 Swagger 配置并一键生成完整的 TS 客户端：
   ```bash
   npx openapi-typescript http://localhost:8080/v3/api-docs -o src/types/api.d.ts
   ```
   _这能确保前端开发时，仍然能获得 100% 准确的 API 请求/响应类型提示与编译期纠错。_

### 5. 遵守 Service 封装层规范 (防腐层)

请务必遵循 [AGENTS.md](file:///AGENTS.md) 中的**服务层（Service Layer）封装规范**：

- 所有网络请求（包括自动生成的 SDK 客户端）必须统一封装在 `frontend/src/services/` 目录下（例如 `services/auth.ts`）。
- UI 组件仅能引入并调用 Service 暴露的普通异步函数，**绝对禁止**将异构后端 SDK 语法直接泄露到 React Page 组件中。这样能确保未来无论底层接口如何变更，UI 视图层均无需发生任何重构。

---

## 数据库与 ORM 选型推荐 (Database & ORM Recommendations)

本项目 **已内置** Drizzle ORM + `bun:sqlite` 作为默认数据库层，开箱即用：

- **Schema 定义**：`apps/api/src/db/schema.ts`（唯一事实源）

<!-- region:template-only -->

- **结构自举**：`apps/api/src/db/bootstrap.ts` 自动识别两种来源 —— 存在 `apps/api/init.sql` 时在空库执行单份初始化脚本；否则使用 `apps/api/drizzle/` 迁移链

<!-- endregion:template-only -->

- **连接配置**：`apps/api/src/db.ts`（惰性单例 + 自举 + admin 种子；`src/db/index.ts` 只导出 drizzle 工厂与 schema）
- **Drizzle 配置**：`apps/api/drizzle.config.ts`

<!-- region:template-only -->

- **模板仓库**：只提交单份 `apps/api/init.sql`（`bun --filter api db:init:generate` 从 schema.ts 生成，**不维护迁移链**）
- **scaffold 生成项目**：`apps/api/init.sql` 会被删除，改为 `apps/api/drizzle/` 迁移链（scaffold 自动生成 baseline）

<!-- endregion:template-only -->

- **本地数据库**：`apps/api/data/sqlite.db`（已被 `.gitignore` 排除）
- **种子数据**：`admin / demo / viewer` 三个用户 + 7 条演示消息（`bun run db:reset` 时写入）
- **登录**：demo 模式，`users` 表暂无 password 列（账号 `admin`，密码任意 6 位以上）；接入正式认证时在 `apps/api/src/utils/password.ts` 的 bcrypt 工具上补齐 password 列与校验

<!-- region:template-only -->

### 常用开发流程

**模板仓库（当前仓库）** —— 部署级别无记忆，不维护迁移链：

1. 修改 `apps/api/src/db/schema.ts`
2. 运行 `bun --filter api db:init:generate` 重新生成 `apps/api/init.sql`（禁止在模板里 `db:generate`，会被守卫拦下）
3. 运行 `bun run db:reset` 重建本地库并播种
4. 首次数据库访问时（惰性初始化）若库为空会自动执行 `init.sql`

**scaffold 生成项目** —— 正常迁移流程：

1. 修改 `apps/api/src/db/schema.ts`
2. 运行 `bun --filter api db:generate` 生成增量迁移（scaffold 已生成 baseline）
3. 重启 API，首次数据库访问时（惰性初始化）自动应用迁移
4. 本地结构变更后 `bun run db:reset` 重建

> `migrate:check` 在 CI check 阶段预检数据库结构：模板校验 `init.sql` 与 `schema.ts` 一致，生成项目校验 drizzle journal/snapshot/drift。

### 部署形态（模板自部署 vs 生成项目）

|            | 模板仓库 self-deploy                                       | scaffold 生成项目         |
| ---------- | ---------------------------------------------------------- | ------------------------- |
| compose    | `compose.self.yml`（**不会**复制进生成项目）               | `compose.test.yml`        |
| 数据卷     | `/app/data` 用 **tmpfs**，容器重建即空库（部署级别无记忆） | `./data` 绑定卷，数据持久 |
| 数据库结构 | 空库执行单份 `init.sql`                                    | drizzle 迁移链            |
| 演示数据   | `DEMO_MODE=true`（启动自动种 7 条）                        | 默认关闭，由业务数据驱动  |

> CI 的 `deploy-test` 会按文件存在性自动选择 compose：模板仓库用 `compose.self.yml`，生成项目（无该文件）回落到 `compose.test.yml`，因此「无记忆」规则不会泄漏到新项目。

### 脚手架选项

使用 `wecode-project-scaffolder` 创建新项目时：

> 生成项目会自动移除模板专属文件（`apps/api/init.sql`、`gen-init-sql.ts`、`compose.self.yml`、AGENTS 的 template-only 规则区），并生成 drizzle baseline 迁移；「无记忆部署 / 无迁移脚本」规则只属于模板仓库。

- `--db drizzle`（monorepo 默认）：保留内置数据库层（迁移 + seed + auth/user/notification 模块）
- `--db none`：仅 flat 模板支持；monorepo 模板会直接报错退出（DB 模块依赖 `apps/api/src/db`，剥离后无法编译）
- `--clean-demo`：删除演示页，同时清理通知展示页专用的 `demo-notifications.ts` / `useDemoNotifications.ts`（通知中心组件与真实数据层保留；clean 项目用 `isAuthenticated` gate，未登录不会请求通知接口）
- flat 模板（Go/Kotlin）只生成 `/api/hello` 等最小后端，**不含通知后端**；如需消息中心请自行实现对应端点或改用 monorepo

### 其他架构的数据库选型

使用脚手架创建平铺异构项目时，可选择以下数据库方案：

**Go 后端 → GORM + SQLite / PostgreSQL**

- Go 社区事实标准，支持 Auto-Migrate 自动建表
- 本地数据库文件：`backend/gorm.db`

**Kotlin 后端 → Spring Data JPA + H2 / MySQL**

- Spring Boot 官方 starter + Hibernate JPA，开发阶段使用内存型 H2
- 启动：`gradle bootRun`，JPA 自动初始化表结构

---

<!-- endregion:template-only -->

## 部署方案 (Deployment Strategies)

本项目支持两种主流的部署模式，您可以根据开发速度与成本考量自由切换。

### 方案一：前后端一把梭 (Fullstack Monolith Deployment) — 💡 低成本、单实例推荐

在该模式下，您的 Hono 后端服务器将同时提供 API 路由并托管前端编译出的静态资源包。您在生产环境只需要运行一个 Node.js 进程。

#### 1. 前后端配置整合

在 `apps/api/src/index.ts` 中引入 Hono 的静态托管中间件：

```typescript
import { serveStatic } from "@hono/node-server/serve-static"

// 托管前端编译生成的静态资源 (在生产环境将 web/dist 作为静态资源服务根目录)
app.use("/*", serveStatic({ root: "../web/dist" }))
```

#### 2. 构建与运行步骤

```bash
# 1. 在根目录下编译打包所有项目 (生成 shared/dist, api/dist, web/dist)
bun run build

# 2. 运行后端服务
cd apps/api
bun run start
```

_此时，访问后端服务地址（如 `http://your-server-ip:3000`），即可直接访问运行完整的 React 前端网页，且所有 `/api` 接口完美同源工作。_

---

### 方案二：前后端分离 (Separated Deployment) — 💡 高弹性、高并发推荐

在该模式下，前端和后端是完全解耦独立部署的。前端部署在静态托管平台上，后端部署在独立的应用服务器上。

#### 1. 前端部署 (Vite SPA)

- **构建前端静态文件**：在根目录下运行 `bun run build:web`（或 `bun run build`）。
- **分发静态文件**：直接将 `apps/web/dist` 目录内的所有文件部署到 CDN、腾讯云 COS、阿里云 OSS、Nginx，或免费静态托管平台（如 Cloudflare Pages, Netlify, Vercel）。
- _由于是纯静态资源，此部署几乎是**零成本**且具备极高的抗并发能力。_

#### 2. 后端部署 (Hono API)

- **构建后端服务**：在根目录下运行 `bun run build:api`。
- **运行后端进程**：可以使用 Docker、PM2 等进程管理器将 `apps/api/dist` 部署在您的云服务器上，并公开端口（如 `3000`）。
- **跨域处理**：已在 `apps/api/src/index.ts` 中集成了 `cors()` 中间件，前端可以通过跨域安全地发起 API 调用（此时需要修改前端请求的 BaseURL 域名，或者在前端的托管服务器上配置反向代理）。

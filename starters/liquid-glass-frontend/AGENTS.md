# AI Developer Guide

This project is AI-Native. Follow these guidelines when modifying or creating components and pages.

## Design System

- **MUST read and follow** the [DESIGN.md](./DESIGN.md) specification for all visual tokens, colors, typography, layout grid, glassmorphism, responsive styles, animations, and structural page/dialog/table layout rules.
- **Never hardcode colors** (`hex` / `rgba` / Tailwind 原色类)。用 `variant="destructive"` 或主题变量（`style={{ color: "var(--lg-danger)" }}`），token 见 [theme-tokens.css](apps/web/src/theme-tokens.css) / [design-utils.css](apps/web/src/design-utils.css)。主题色通过 `theme-tokens.css` 的 `--theme-*` 种子与 `[data-theme-color]` 预设块切换，**语义状态色（success/danger/warning/info）不跟随主题色**。
- **主题色入口**：顶栏 Palette 面板与个人设置页共用 [ThemeColorPicker](apps/web/src/components/shared/ThemeColorPicker.tsx)；色板元数据在 [theme-colors.ts](apps/web/src/lib/theme-colors.ts)。新增预设步骤见 README「切换主题色」。

## Key Files

[theme-tokens.css](apps/web/src/theme-tokens.css) Design tokens · [theme-colors.ts](apps/web/src/lib/theme-colors.ts) Theme color presets · [design-utils.css](apps/web/src/design-utils.css) Glass utilities · [menu-config.ts](apps/web/src/lib/menu-config.ts) Sidebar & ⌘K index · [App.tsx](apps/web/src/App.tsx) Main Router · [schema.ts](apps/api/src/db/schema.ts) Database Schema · [shared/src](packages/shared/src) Shared Schemas & TS Types

<!-- region:template-only -->

## 模板仓库专属规则（scaffold 生成项目会剥离本段）

- **本仓库是脚手架模板本身，部署级别无状态**：self-deploy 用 [compose.self.yml](compose.self.yml)（`/app/data` 挂 tmpfs，容器重建即空库；`DEMO_MODE=true` 自动种 7 条演示通知）。生成项目用 `compose.test.yml` 的 `./data` 持久卷，不受本规则影响。
- **模板不提交迁移脚本**：数据库结构唯一来源是 [schema.ts](apps/api/src/db/schema.ts)，生成单份 [init.sql](apps/api/init.sql)。修改 schema 后运行 `bun --filter api db:init:generate`；禁止在模板里 `db:generate`（守卫会拒绝）。
- **生成项目相反**：scaffold 会删除 `init.sql` 并生成 drizzle baseline，此后用 `bun --filter api db:generate` / `bun --filter api db:migrate` 正常升级。
- 模板 `migrate:check` 校验 `init.sql` 与 `schema.ts` 一致；生成项目 `migrate:check` 校验迁移 journal/snapshot/drift。

<!-- endregion:template-only -->

## Add a New Page

1. **Create**: New component under `apps/web/src/pages/` (Tailwind CSS)
2. **Route**: Lazy-load via `React.lazy`（所有页面强制，LoginPage 除外），register in [App.tsx](apps/web/src/App.tsx) inside `<Route element={<SidebarLayout />}>`
3. **Nav**: Add entry to `menuGroups` in [menu-config.ts](apps/web/src/lib/menu-config.ts) (`title` / `path` / `icon` / `keywords` / `englishSub`)

<!-- region:api -->

## API & Service Layer

- **No direct imports** of `api` (`@/lib/api`), `fetch`, `axios`, or backend RPC clients in UI components. Network logic in `apps/web/src/services/`.
- **后端模块化**：`apps/api/src/modules/<domain>/` 含 `.route.ts`（薄 handler）+ `.service.ts`（业务 + 审计）。参考活教材：[modules/user](apps/api/src/modules/user/) · [modules/auth](apps/api/src/modules/auth/)。只读模块可不抽 service。
- **Service 约定**：写操作与写审计的函数首参 `OpCtx`（`opCtxMiddleware` 在 authMiddleware 后统一注入，handler 用 `c.get("opCtx")` 获取）；纯只读查询（如 `getMe(email)`）不写审计，不必接。抛领域错误 `ServiceError`，handler 用 `mapServiceError` 转 HTTP。
- **try/catch 约定**：只读且无业务分支的 handler 可省略 try/catch（全局 onError 兜底）；写操作或含业务判断的 handler 必须 try/catch + `mapServiceError`。
- **审计日志**：CRUD → `auditedInsert/Update/Delete` + `TableAuditConfig`（内联在 service）；非 CRUD → `createAuditor(module)`。禁止裸调 `writeLog`。**未认证入口**只挂 `opCtxMiddleware`（不挂 authMiddleware）拿壳 OpCtx，再 `audit({ ...ctx, operator, ... })` 覆盖身份；ip/ua/requestId 随 `...ctx` 整体带入，**禁止手工逐字段拼装**。身份取值规则与写法示例见 [modules/auth](apps/api/src/modules/auth/) 文件头及 [no-audit-fn-without-opctx](eslint-rules/no-audit-fn-without-opctx.js) JSDoc。
- **权限体系**：权限码唯一事实源是 [permissions.ts](packages/shared/src/permissions.ts) 的 `PERMISSION_REGISTRY`（`resource:action` 命名 + `PermissionCode` 类型），新增权限只需注册表加一条。路由级默认用 `requirePermission(...codes)` 中间件；资源级、字段级或依赖业务状态的授权由 service 领域方法表达，不要求硬塞进中间件。handler 原则上不手写 `if (!hasPermission(...))`，确需动态判断的例外必须 `eslint-disable-next-line` 并附理由。
- **共享基础设施** `apps/api/src/shared/`：audited-crud · audit-log · op-context · service-error · logger · notification（通用消息内核）· notification-bus
- **消息通知内核（业务无关）**：业务只调 `notify() / notifyMany() / notifySafe()`（[shared/notification.ts](apps/api/src/shared/notification.ts)），不要自己 insert `notifications` 表。`type` 是不透明字符串（不建枚举、不写 shared 常量表）、`payload` 承载业务字段；收件人只从 JWT 取。已读/删除是用户自有高频状态，**不写审计**（`notification.service.ts` 头注释有理由）；清理类批量操作另行审计。SSE 用 `Authorization: Bearer` + fetch 流，禁止把 token 放 query string。wire→view 映射唯一入口是 [notification-adapter.ts](apps/web/src/lib/notification-adapter.ts)。演示/测试环境可设 `DEMO_MODE=true`（启动幂等种 7 条演示通知，并开放 `POST /notifications/dev/{push,reset}`；真实项目必须保持关闭）。
- **Database**: Drizzle ORM + `bun:sqlite`。Schema 唯一事实源 [db/schema.ts](apps/api/src/db/schema.ts)，首次数据库访问时（惰性初始化）由 [db/bootstrap.ts](apps/api/src/db/bootstrap.ts) 自动识别并应用 `apps/api/drizzle/` 迁移。修改 schema 后运行 `bun --filter api db:generate` 生成迁移并提交（journal / snapshot 必须配对）；本地重建用 `bun run db:reset`。
- Request/response schemas in `packages/shared/src/`, shared between frontend & backend.

<!-- endregion:api -->

## State Management

- **Server state goes through TanStack Query hooks** in `apps/web/src/hooks/queries/` (query keys in [query-keys.ts](apps/web/src/lib/query-keys.ts), client config in [query.ts](apps/web/src/lib/query.ts)). Do not put server data in Zustand; invalidate the domain key after mutations instead of manual refetch.
- **Zustand** stores in `apps/web/src/stores/` are reserved for auth and UI/client state only (`auth` · `layoutStore`).
- **客户端列表分页**用 `usePagedList`（`@/hooks/usePagedList`，过滤+排序+分页组合）；服务端分页走 Query hooks + API 参数。
- 避免 selector 内的派生状态计算触发重渲染。用 `useMemo` 或提取到组件外。

## 架构门禁（CI check 阶段阻断）

分工：**能用 AST 判定的走 ESLint（自定义规则在 `eslint-rules/`，`bun run lint` 覆盖 web + api + shared）；跨文件不变量才留给 `bun run arch:check`（只扫 `apps/web/src`）**。

- `no-toisostring-slice`：禁止 `.toISOString().slice/split(...)` 截日期（UTC+ 时区会前移一天），用 `formatDate`（`@/lib/date-utils`）。
- `no-tailwind-raw-colors`：pages/components 的 `className` 禁止 Tailwind 原色类（`text-red-500` 等），用语义化 token。
- `no-service-import-in-ui`：pages/components 禁止值导入 `@/services/*`（type-only 允许），服务端数据走 `hooks/queries/`。
- `no-raw-viewport-check`：pages/components 禁止直读 `window.innerWidth`——结构分叉用 `useIsMobile()`（`@/hooks/use-mobile`），样式差异用 Tailwind 断点类，触摸检测用 `pointer-coarse:`。
- `no-audit-fn-without-opctx`：`modules/**/*.service.ts` 中直接写审计（调用 `audit` / `auditedInsert|Update|Delete`）的**导出**函数，首参必须标注 `OpCtx`；只防常见签名漂移，不保证间接审计与身份字段完整。
- `no-restricted-syntax`：`modules/**/*.ts` 禁裸调 `writeLog(`；`*.route.ts` 默认禁手写 `hasPermission(`，资源级、字段级及业务状态相关的动态授权不受此限，handler 例外须带理由豁免。
- `arch:check`：页面必须在 `App.tsx` 里 `React.lazy`（跨文件，ESLint 单文件扫不到）；UI 层禁 `@/lib/api` / axios / sonner 直连。
- 豁免：`// eslint-disable-next-line <rule-id> -- <理由>`；未使用的 disable 会报错，修好后必须删。文件级永久豁免走 `eslint.config.js` 的 `files:` + `"rule": "off"` 块并附理由。
- **改规则前先读** `eslint-rules/*.js` 的 JSDoc 与 `eslint.config.js` 注释——判据、盲区、设计理由都在那里，不在本文件。

## Shared Components (`components/shared/`)

`DataTable` 数据表格 (`mobileCard` renders card list on <md, drag reorder supported) · `MobileCard` mobile card content primitives (Header/Body/Footer 三段式 + Compact) · `StatusBadge` 启用/停用徽章 · `ThemeColorPicker` 主题色选择器 · `ResponsiveDialog` desktop Dialog / mobile bottom Sheet · `DetailRow` · `SectionCard` · `NullableText` · `DateCell` · `VirtualDataTable` virtual scroll (1000+ rows) · `ConfirmDialog` 确认弹窗 · `FileUpload` 拖拽上传 · `PageSkeleton` 骨架屏 · `FilterBar` filter toolbar (mobile: collapses into bottom-sheet via `search`/`sheetLabels`/`activeFilterCount`) · `CommandPalette` ⌘K · `SmartPagination` 分页 · `NotificationCenter` 消息中心（`NotificationBell` + Popover + `NotificationPanel`，props 驱动；业务类型 / 文案高亮 / 跳转通过 `typeRegistry`、`emphasis`、`onItemClick` 注入；后端通用内核、SSE 与数据层见 README「消息通知后端」）

## Page Transitions

Native **View Transitions API** (React Router DOM v7). All `<NavLink>` use `viewTransition` prop. New routes inherit transitions automatically.

## Code Conventions

- **页面拆分标准**：页面组件超过 400 行触发拆分，拆分对象是自包含大块（弹窗/表单体/局部块 → `pages/<module>/components/`，表单/业务逻辑 → `pages/<module>/hooks/`）；不为凑行数硬拆小块（确认弹窗/列定义等可留主文件），拆后主文件以清晰编排为目标（~600 行可接受）。
- **Import order**: `eslint-plugin-simple-import-sort`, auto-fix via `bun run lint:fix`
- **Type Safety**: tsconfig enforces `noUnusedLocals` + `noUnusedParameters`
- **Toast**: Use `@/lib/toast` (`showSuccess` / `showError` / `showWarning` / `showInfo`). Never import sonner directly.
- **Forms**: Use `react-hook-form` + Zod schemas from `shared` package for validation.
- **Path alias**: `@/*` maps to `./src/*` in web app.
- **Date/Time**: 展示用 `formatDate` / `formatTimestamp`（`@/lib/date-utils`，本地时区）；日期范围查询前端用 `getLocalDayBoundaryISO(date, "start"|"end")` 构造完整 ISO。

## Testing

- **测试文件就近放置**：`foo.ts` → 同目录 `foo.test.ts`
- **API 端用 `bun:test`**：`import { describe, it, expect } from "bun:test"`，原生支持 `bun:sqlite`
- **Web/Shared 端用 Vitest**：`import { describe, it, expect } from 'vitest'`，配合 `happy-dom`
- **前端 Service 测试**：`vi.mock('@/lib/api')` mock axios 实例，验证 URL/参数/返回值
- **前端 Store 测试**：直接操作 `useXxxStore.getState()`，`beforeEach` 中 `localStorage.clear()` + `setState` 重置
- **API 路由测试**：内存 SQLite（`:memory:`）+ migrate + 种子数据，`beforeEach` 重置
- **API 中间件测试**：mock `jsonwebtoken`，构造 Hono app 用 `app.request()` 模拟请求
- **ESLint 自定义规则测试**：规则同目录放置 `*.test.js`，用 `bun:test` + `RuleTester` 覆盖 valid / invalid 案例，运行 `bun run test:eslint`

### Agent 变更后验证（强制）

- **代码变更后必须立即执行对应测试并通过**：API → `bun run test:api`；Web → `bun run test:web`；Shared → `bun run test:shared`；跨层 → `bun run test`。改 `eslint-rules/` 或 `eslint.config.js` → `bun run lint` + `bun run test:eslint`。
- 未执行 = 任务未完成；失败必须修复重跑直到通过。

## 枚举值规范

- **DB 与接口一律存英文枚举值，中文仅 UI 展示**。枚举定义在 `packages/shared/src/`（英文值常量 + `*_LABELS` 中文映射）；比较用英文字面量，赋值用常量，展示用 `*_LABELS[值]`。
- 颜色/图标等 `Record<string, …>` 映射的 key、test factory 数据同样必须用英文值。

<!-- region:cmds -->

## 🛠️ Commands

```bash
bun run dev          # 自动编译 shared 后并发启动 API (3000) + Web (5173)
bun run typecheck    # 全局类型检查
bun run lint         # ESLint（web + api + shared，含后端架构约束）
bun run lint:fix     # ESLint 自动修复
bun run test         # 运行全部测试（ESLint 规则 + Shared + Web + API）
bun run test:eslint  # 自定义 ESLint 规则的 RuleTester 测试
bun run test:api     # 仅 API 测试 (bun:test)
bun run test:web     # 仅前端测试 (Vitest)
bun run test:shared  # 仅 Shared 包测试 (Vitest)
bun run arch:check   # 跨文件架构约束扫描（页面必须 React.lazy 等）
bun --filter api db:generate  # 生成项目：schema 变更后生成迁移
bun --filter api db:migrate   # 生成项目：把迁移应用到本地数据库
bun run db:reset     # 重置本地开发数据库（重建 + 种子）
```

<!-- region:template-only -->

**模板仓库专属命令**（生成项目已删除 init.sql，不适用）：

```bash
bun --filter api db:init:generate # 从 schema.ts 重新生成 init.sql
bun --filter api db:init:check    # 校验 init.sql 与 schema.ts 是否一致
```

<!-- endregion:template-only -->

<!-- endregion:cmds -->

## Git Conventions

**Commit**: `<type>(<scope>): <subject>` — subject ≤50 chars, imperative mood
**Type**: `feat` · `fix` · `refactor` · `docs` · `test` · `chore` · `perf` · `ci` · `style`
**Branch**: `feature/<module>-<desc>` · `fix/` · `hotfix/` · `release/v<ver>` · `refactor/`
**Rule**: Never push cross-branch. Always checkout target branch before push.
**PR**: Must include change description + scope + test result + linked ID (`Fixes #123`); ≤500 lines.

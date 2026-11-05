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
- **450 行棘轮白名单与脚手架联动**：`scripts/arch-check.ts` 的 `LONG_FILE_RATCHET` 按模板 demo 页路径写死；scaffold 在 `--clean-demo` 删页、`--include-ci` / `--mode add-ci` 用模板原件覆盖 arch-check 后，会调用 `pruneMissingLongFileRatchet()` 按目标项目实际文件剪掉失效条目，否则生成项目跑 `bun run arch:check` 会报 `overlong-ratchet-missing`。增删白名单条目不需要改 scaffold 的文件清单；但 helper 依赖 `const LONG_FILE_RATCHET` 字面量与 `"<相对路径>": <行数>,` 的单行条目格式，改动这两个形态需同步更新 helper。

<!-- endregion:template-only -->

## Add a New Page

1. **Create**: New component under `apps/web/src/pages/` (Tailwind CSS)
2. **Route**: Lazy-load via `React.lazy`（所有页面强制，LoginPage 除外），register in [App.tsx](apps/web/src/App.tsx) inside `<Route element={<SidebarLayout />}>`
3. **Nav**: Add entry to `menuGroups` in [menu-config.ts](apps/web/src/lib/menu-config.ts) (`title` / `path` / `icon` / `keywords` / `englishSub`；需要按权限隐藏时加 `permission: PERMISSIONS.X`，不填默认全员可见)

<!-- region:api -->

## API & Service Layer

- **业务模块一键生成**：`bun run gen:module --name contract --label "合同" --icon FileText`（加 `--mode sortable` 生成字典/拖拽重排模块）。一条命令生成 5 要素骨架（shared 契约 / 后端 service+route+测试 / 前端 service+hooks+页面+表单）并自动注册权限码、审计模块、导出、表结构、API 挂载、query key、`App.tsx` 懒加载路由与菜单项；配合 [business-feature-builder](.agents/skills/business-feature-builder/SKILL.md) 技能、5 要素规格书模板 [docs/specs/\_template.md](docs/specs/_template.md) 与人机协同手册 [WORKFLOW.md](./WORKFLOW.md) 对齐需求、替换占位字段并跑门禁。注册位置由源码里的 `[gen:module:*]` 注释锚点定位，**勿删改锚点**；改生成器 / 锚点后跑 `bun run test:scripts`（含真实锚点断言）与 `bun run gen:module --name contract --label "合同" --dry-run` 自检。
- **No direct imports** of `api` (`@/lib/api`), `fetch`, `axios`, or backend RPC clients in UI components. Network logic in `apps/web/src/services/`.
- **后端模块化**：`apps/api/src/modules/<domain>/` 含 `.route.ts`（薄 handler）+ `.service.ts`（业务 + 审计）。参考活教材：[modules/user](apps/api/src/modules/user/) · [modules/auth](apps/api/src/modules/auth/)；只读查询参考 [modules/log](apps/api/src/modules/log/)（`GET /logs` 审计日志，service 负责 SQL 而不接 OpCtx——B2 门禁同样禁止只读 route 直连 DB）。
- **Service 约定**：写操作与写审计的函数首参 `OpCtx`（`opCtxMiddleware` 在 authMiddleware 后统一注入，handler 用 `c.get("opCtx")` 获取）；纯只读查询（如 `getMe(email)`）不写审计，不必接。抛领域错误 `ServiceError`，handler 用 `mapServiceError` 转 HTTP。
- **try/catch 约定**：只读且无业务分支的 handler 可省略 try/catch（全局 onError 兜底）；写操作或含业务判断的 handler 必须 try/catch + `mapServiceError`。
- **审计日志**：CRUD → `auditedInsert/Update/Delete` + `TableAuditConfig`（内联在 service）；非 CRUD → `createAuditor(module)`。禁止裸调 `writeLog`。只读查询 API 见 [modules/log](apps/api/src/modules/log/)（`GET /logs`，需 `audit:view`，不提供客户端写入口）。**未认证入口**只挂 `opCtxMiddleware`（不挂 authMiddleware）拿壳 OpCtx，再 `audit({ ...ctx, operator, ... })` 覆盖身份；ip/ua/requestId 随 `...ctx` 整体带入，**禁止手工逐字段拼装**。身份取值规则与写法示例见 [modules/auth](apps/api/src/modules/auth/) 文件头及 [no-audit-fn-without-opctx](eslint-rules/no-audit-fn-without-opctx.js) JSDoc。
- **权限体系**：权限码唯一事实源是 [permissions.ts](packages/shared/src/permissions.ts) 的 `PERMISSION_REGISTRY`（`resource:action` 命名 + `PermissionCode` 类型），新增权限只需注册表加一条。路由级默认用 `requirePermission(...codes)` 中间件；资源级、字段级或依赖业务状态的授权由 service 领域方法表达，不要求硬塞进中间件。handler 原则上不手写 `if (!hasPermission(...))`，确需动态判断的例外必须 `eslint-disable-next-line` 并附理由。登录与 `GET/PUT /users/me` 用 `permissionsForRole(role)` 把角色解析成 `permissions: string[]` 随 user 下发——这是前端唯一的权限数据源；DB role 为 NULL 时按 `DEFAULT_ROLE`（user）解析，与 JWT 签发兜底同源。
- **共享基础设施** `apps/api/src/shared/`：audited-crud · audit-log · op-context · service-error · logger · notification（通用消息内核）· notification-bus · oss（对象存储双模）· sqlite-ops（SQLite 统计 / VACUUM / 热备）
- **消息通知内核（业务无关）**：业务只调 `notify() / notifyMany() / notifySafe()`（[shared/notification.ts](apps/api/src/shared/notification.ts)），不要自己 insert `notifications` 表。`type` 是不透明字符串（不建枚举、不写 shared 常量表）、`payload` 承载业务字段；收件人只从 JWT 取。已读/删除是用户自有高频状态，**不写审计**（`notification.service.ts` 头注释有理由）；清理类批量操作另行审计。SSE 用 `Authorization: Bearer` + fetch 流，禁止把 token 放 query string。wire→view 映射唯一入口是 [notification-adapter.ts](apps/web/src/lib/notification-adapter.ts)。演示/测试环境可设 `DEMO_MODE=true`（启动幂等种 7 条演示通知，并开放 `POST /notifications/dev/{push,reset}`；真实项目必须保持关闭）。
- **对象存储与 SQLite 运维工具箱（零表依赖，不写审计）**：上传 / 下载统一走 [shared/oss.ts](apps/api/src/shared/oss.ts)，禁止业务直接 import `ali-oss`（ESLint `no-restricted-imports` 门禁，静态 / re-export / 动态 import() 均拦截）；`OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` / `OSS_BUCKET` 同时配置才启用 OSS 模式，否则降级本地 mock，mock 的本地回退路由由业务方传入（`MockOssRoutes`），上传上限统一读 `UPLOAD_MAX_SIZE_MB`。数据库统计 / 优化 / 备份走 [shared/sqlite-ops.ts](apps/api/src/shared/sqlite-ops.ts)（`getSqliteStats` / `runSqliteVacuum` / `createSqliteBackup`，`VACUUM INTO` 快照 + 本地或 OSS 轮转）；是否审计、谁能触发由调用方 service 决定。危险操作前端确认统一用 `DangerZoneGroup`。
- **Database**: Drizzle ORM + `bun:sqlite`。Schema 唯一事实源 [db/schema.ts](apps/api/src/db/schema.ts)，首次数据库访问时（惰性初始化）由 [db/bootstrap.ts](apps/api/src/db/bootstrap.ts) 自动识别并应用 `apps/api/drizzle/` 迁移。修改 schema 后运行 `bun --filter api db:generate` 生成迁移并提交（journal / snapshot 必须配对）；本地重建用 `bun run db:reset`。
- Request/response schemas in `packages/shared/src/`, shared between frontend & backend.

<!-- endregion:api -->

## State Management

- **Server state goes through TanStack Query hooks** in `apps/web/src/hooks/queries/` (query keys in [query-keys.ts](apps/web/src/lib/query-keys.ts), client config in [query.ts](apps/web/src/lib/query.ts)). Do not put server data in Zustand; invalidate the domain key after mutations instead of manual refetch.
- **Zustand** stores in `apps/web/src/stores/` are reserved for auth and UI/client state only (`auth` · `layoutStore`).
- **前端权限消费**：只读 auth store 中的 `user.permissions: string[]`（登录成功时写入；`GET /users/me` 同样返回但不回写 store；refresh 只旋转 token、不刷新角色）。禁止前端 import `ROLE_PERMISSIONS` / `ALL_PERMISSIONS` / `permissionsForRole` 自行推导角色。按钮/区块显隐用 `usePermission().can/canAny` 或 `<PermissionGate perm={PERMISSIONS.X}>`；`menu-config.ts` 的 `MenuItem.permission` 不填默认全员可见、填了由侧边栏与 ⌘K 自动过滤；面包屑用 `getBreadcrumbs(pathname)` 纯路径派生（与权限解耦）。导航隐藏 ≠ 鉴权，页面/接口仍由后端 `requirePermission` 把关。
- **客户端列表分页**用 `usePagedList`（`@/hooks/usePagedList`，过滤+排序+分页组合）；服务端分页走 Query hooks + API 参数。
- 避免 selector 内的派生状态计算触发重渲染。用 `useMemo` 或提取到组件外。

## 架构门禁（CI check 阶段阻断）

分工：**能用 AST 判定的走 ESLint（自定义规则在 `eslint-rules/`，`bun run lint` 覆盖 web + api + shared）；跨文件不变量才留给 `bun run arch:check`（只扫 `apps/web/src`）**。

- `no-toisostring-slice`：禁止 `.toISOString().slice/split(...)` 截日期（UTC+ 时区会前移一天），用 `formatDate`（`@/lib/date-utils`）。
- `no-tailwind-raw-colors`：全部 `apps/web/src/**/*.tsx`（含 App.tsx / layouts / router）禁用 Tailwind 原色类（`text-red-500` 等），以及 JSX 内联 `style` 中的硬编码颜色字面量（`#hex` / `rgb()` / `hsl()`，函数名大小写不敏感）；用语义化 token 或 `color-mix(...)`。token 混入字面量（如 `linear-gradient(var(--a), #fff)`）同样报错，`rgba(var(--*-rgb), α)` 这类分量全部来自 token 的组合放行。
- `no-service-import-in-ui`：pages/components 禁止值导入 `@/services/*`（type-only 允许），服务端数据走 `hooks/queries/`。
- `no-raw-viewport-check`：pages/components 禁止直读 `window.innerWidth`——结构分叉用 `useIsMobile()`（`@/hooks/use-mobile`），样式差异用 Tailwind 断点类，触摸检测用 `pointer-coarse:`。
- `no-audit-fn-without-opctx`：`modules/**/*.service.ts` 中直接写审计（调用 `audit` / `auditedInsert|Update|Delete`）的**导出**函数，首参必须标注 `OpCtx`；只防常见签名漂移，不保证间接审计与身份字段完整。
- `no-restricted-syntax`：`modules/**/*.ts` 禁裸调 `writeLog(`；`*.route.ts` 默认禁手写 `hasPermission(`，资源级、字段级及业务状态相关的动态授权不受此限，handler 例外须带理由豁免。
- `no-restricted-imports` + `no-restricted-syntax`：`*.route.ts` 禁止直连数据库——静态 import / re-export / 动态 `import()` 均拦截 `**/db*`、`drizzle-orm`、`bun:sqlite`；查询/写入与业务规则必须下沉到同模块 `*.service.ts`。
- `no-restricted-imports` + `no-restricted-syntax`（api）：`apps/api/src/modules/**` 禁止直连 `ali-oss`（静态 / re-export / 动态 `import()` 均拦截），对象存储统一走 `shared/oss.ts` 双模封装；模块测试文件放行（允许 mock SDK）。断言见 `eslint-rules/api-oss-import-guard.test.js`。
- `no-restricted-imports`（web）：`apps/web/src/**` 禁止 import `ROLE_PERMISSIONS` / `ALL_PERMISSIONS` / `permissionsForRole` 自行推导权限，前端只消费 wire 下发的 `user.permissions`（`usePermission` / `PermissionGate`）。盲区：namespace import（`import * as shared`）不受 `importNames` 约束，靠评审兜底。
- `arch:check`：页面必须在 `App.tsx` 里 `React.lazy`（跨文件，ESLint 单文件扫不到）；UI 层禁 `@/lib/api` / axios / sonner 直连；单文件行数棘轮（pages 下 `.tsx` + `apps/api/src/modules/**/*.ts`，硬上限 450 行、口径同 `wc -l`；存量超长文件列入 `LONG_FILE_RATCHET`，高于基线或低于基线未下调都报错——只许减不许增）。
- 豁免：`// eslint-disable-next-line <rule-id> -- <理由>`；未使用的 disable 会报错，修好后必须删。文件级永久豁免走 `eslint.config.js` 的 `files:` + `"rule": "off"` 块并附理由。
- **改规则前先读** `eslint-rules/*.js` 的 JSDoc 与 `eslint.config.js` 注释——判据、盲区、设计理由都在那里，不在本文件。

## Shared Components (`components/shared/`)

`DataTable` 数据表格 (`mobileCard` renders card list on <md, drag reorder supported) · `MobileCard` mobile card content primitives (Header/Body/Footer 三段式 + Compact) · `StatusBadge` 启用/停用徽章 · `ThemeColorPicker` 主题色选择器 · `ResponsiveDialog` desktop Dialog / mobile bottom Sheet · `DetailRow` · `SectionCard` · `NullableText` · `DateCell` · `VirtualDataTable` virtual scroll (1000+ rows) · `ConfirmDialog` 确认弹窗 · `FileUpload` 拖拽上传 · `PageSkeleton` 骨架屏 · `FilterBar` filter toolbar (mobile: collapses into bottom-sheet via `search`/`sheetLabels`/`activeFilterCount`) · `CommandPalette` ⌘K · `SmartPagination` 分页 · `NotificationCenter` 消息中心（`NotificationBell` + Popover + `NotificationPanel`，props 驱动；业务类型 / 文案高亮 / 跳转通过 `typeRegistry`、`emphasis`、`onItemClick` 注入；后端通用内核、SSE 与数据层见 README「消息通知后端」） · `PermissionGate` 声明式权限门控 · `AuditDiffViewer` 审计变更三态 Diff（标量 / 标签数组 / 键值对象，自动展开 snapshot 形） · `DangerZone` 危险操作分组卡（二次确认 + 可选密码透传 + 执行中 loading 锁）

## Page Transitions

Native **View Transitions API** (React Router DOM v7). All `<NavLink>` use `viewTransition` prop. New routes inherit transitions automatically.

## Code Conventions

- **页面拆分标准**：页面组件超过 400 行触发拆分（`bun run arch:check` 的 450 行是 CI 硬上限，400 行是拆分软线），拆分对象是自包含大块（弹窗/表单体/局部块 → `pages/<module>/components/`，表单/业务逻辑 → `pages/<module>/hooks/`）；不为凑行数硬拆小块（确认弹窗/列定义等可留主文件），拆后主文件以清晰编排为目标（~600 行可接受）。
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
- **工具脚本测试**：`scripts/*.ts` 同目录 `*.test.ts`，用 `bun:test`，运行 `bun run test:scripts`（已包含在 `bun run test`）
- **API 路由测试**：内存 SQLite（`:memory:`）+ migrate + 种子数据，`beforeEach` 重置
- **API 中间件测试**：mock `jsonwebtoken`，构造 Hono app 用 `app.request()` 模拟请求
- **ESLint 自定义规则测试**：规则同目录放置 `*.test.js`，用 `bun:test` + `RuleTester` 覆盖 valid / invalid 案例，运行 `bun run test:eslint`

### Agent 变更后验证（强制）

- **代码变更后必须立即执行对应测试并通过**：API → `bun run test:api`；Web → `bun run test:web`；Shared → `bun run test:shared`；跨层 → `bun run test`。改 `eslint-rules/`、`eslint.config.js` 或规则实现 → `bun run test:eslint` + **`bun run lint:nocache`**（ESLint 默认 `--cache` 的 hash 只含配置、不含自定义规则实现，规则改动后带缓存可能复用旧结果；`lint:nocache` 逐包 `--no-cache` 才是可信验收）。
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
bun run lint:nocache # ESLint 无缓存验收（改自定义规则/配置后用，避免旧缓存掩盖）
bun run lint:fix     # ESLint 自动修复
bun run test         # 运行全部测试（ESLint 规则 + scripts + Shared + Web + API）
bun run test:eslint  # 自定义 ESLint 规则的 RuleTester 测试
bun run test:api     # 仅 API 测试 (bun:test)
bun run test:web     # 仅前端测试 (Vitest)
bun run test:shared  # 仅 Shared 包测试 (Vitest)
bun run arch:check   # 跨文件架构约束扫描（页面必须 React.lazy 等）
bun run gen:module   # 业务模块生成器（--mode sortable 生成字典/拖拽重排模块）
bun run test:scripts # scripts/ 工具脚本单测（含 gen:module 生成器）
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

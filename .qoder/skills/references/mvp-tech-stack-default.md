# MVP 极简技术栈默认约束

> 所有 kf-mvp-* 技能 MUST 遵循此默认约束。除非用户显式指定，否则一律按此技术栈实现。
> **权威源**：`starters/liquid-glass-frontend/`（React 19 + Bun + Vite 8 monorepo）。本文件是技能侧镜像约束，任何冲突以脚手架实际代码为准。

---

## 后端（不可协商）

| 组件 | 选型 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Bun | 1.3+ | Bun workspaces，原生 HTTP |
| 框架 | Hono | 4.6+ | 超轻量，TypeScript 原生 |
| 数据库 | SQLite (bun:sqlite) | 内置 | 单文件，零配置 |
| ORM | Drizzle ORM | 0.45+ | 类型安全，SQL-like 语法 |
| 认证 | JWT (jsonwebtoken) | 9.x | 无状态 |
| 密码 | Bun.password | 内置 | argon2id/bcrypt 内置实现 |
| 校验 | Zod | 4.x | 请求体/参数校验 |
| 响应 | `ok(c, data, message)` / `fail(c, status, code, message)` | 脚手架 `src/response.ts` | 统一响应格式 |

## 前端（不可协商）

> 权威源：`starters/liquid-glass-frontend/apps/web/`

| 组件 | 选型 | 版本 | 说明 |
|------|------|------|------|
| 框架 | React | 19.2+ | Hooks |
| 构建 | Vite | 8.x | |
| 语言 | TypeScript | 6.0+ | `noUnusedLocals` + `noUnusedParameters` |
| 路由 | React Router | 7.x | `viewTransition` 启用原生转场 |
| 状态 | Zustand | 5.x | `persist` 中间件 |
| 表单 | react-hook-form | 7.x | + `@hookform/resolvers` |
| 校验 | Zod | 4.x | |
| HTTP | Axios | 1.x | 统一封装在 `src/lib/api.ts`，业务封装在 `src/services/` |
| UI 组件库 | shadcn/ui | latest | 默认选择（`style: radix-nova`，`components.json`） |
| 设计体系 | **Liquid Glass** | — | ★ 默认设计体系（见脚手架 `DESIGN.md`） |
| CSS 框架 | Tailwind CSS v4 | 4.2+ | `@tailwindcss/vite` |
| 图标 | lucide-react | latest | |
| 提示 | sonner（经 `src/lib/toast.ts` 封装） | 2.x | **禁止 UI 层直接 import sonner** |
| 虚拟滚动 | @tanstack/react-virtual | 3.x | 1000+ 行表格 |

### 设计体系（默认不可协商）

**所有 MVP 前端项目默认采用 Liquid Glass 设计体系**，除非用户显式指定其他：

- 📐 规范文档：`starters/liquid-glass-frontend/DESIGN.md`（技能侧镜像：`.qoder/skills/references/liquid-glass/DESIGN.md`）
- 📁 CSS 源文件：`apps/web/src/theme-tokens.css` + `apps/web/src/design-utils.css`（技能侧镜像：`.qoder/skills/references/liquid-glass/`）
- 🏗️ 前端脚手架：`starters/liquid-glass-frontend/` — 复制此目录作为项目起点
- 🎨 默认主色：Qoder 绿 `#22c55e` / `#4be277`
- 🖊️ 字体：Manrope（标题）+ Inter（正文）+ JetBrains Mono（数据/KPI）
- 🌙 默认主题：Dark，`.light` 类切换 Light
- 🧊 玻璃拟态：卡片 `12px` 圆角 + `backdrop-blur(12px)` + 1px 边框
- ⚠️ **禁止硬编码 hex/rgba**，必须用 `--lg-*` CSS 变量或 `design-utils.css` 工具类（`.glass-card` / `.matte-card` / `.liquid-card` / `.glass-row`）
- ⚠️ **禁止**用 Tailwind 默认 `rounded-lg`（8px）做卡片圆角，卡片必须 `rounded-[12px]` 或用 CSS 变量

### UI 框架选择（按项目类型，当用户要求非 shadcn/ui 时）

| 项目类型 | 推荐 | 备选 |
|----------|------|------|
| 企业后台/B端 | Ant Design | Arco Design |
| 通用管理/电商 | shadcn/ui | Ant Design |
| H5 移动端 | Tailwind CSS 自建 | Vant |

选定后不可混用。

## 架构分层（AGENTS.md 强制）

```
pages/ + components/   UI 层 —— 只调用 services/，禁止直连 api/axios/fetch
        ↓
services/              网络层 —— 唯一可 import @/lib/api 的地方
        ↓
lib/api.ts             Axios 实例 + 401 刷新队列
        ↓
Hono API               /auth /users ... 统一 ok/fail 响应
```

四条硬约束（对应 gate R022-R025）：

1. UI 层禁止 `import { api } from "@/lib/api"`
2. UI 层禁止 `import axios` / 裸 `fetch`
3. 除 `lib/toast.ts` 与 `App.tsx`（Toaster）外，禁止 `import "sonner"`
4. 页面必须 `React.lazy()` 引入（LoginPage 除外）

## 测试（不可协商）

| 层级 | 工具 | 版本 |
|------|------|------|
| 单元/集成 | Vitest | 4.x |
| 组件测试 | @testing-library/react | 16.x |
| E2E | Playwright | 1.x |

## 第三方服务（全部 Mock）

| 服务 | Mock 方式 | 切换真实 |
|------|----------|----------|
| 支付 | mockPaymentService | 替换 import 路径 |
| 短信 | mockSmsService | 替换 import 路径 |
| 存储 | 本地 uploads/ 目录 | 替换 import 路径 |
| 推送 | mockPushService | 替换 import 路径 |

## MVP 明确不引入

- Redis / 消息队列 / 限流 / WAF
- 缓存策略 / CDN / 索引优化
- XSS/CSRF 防护（JWT 基础认证除外）
- 日志系统 / 监控告警
- 性能优化 / 并发控制 / 安全加固

## 项目结构

```
project/
├── apps/
│   ├── web/                 # React 19 + Vite 8 + shadcn/ui
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx              # Routes + React.lazy + Toaster
│   │   │   ├── router/              # ProtectedRoute
│   │   │   ├── stores/              # Zustand
│   │   │   ├── services/            # 网络层（唯一可 import @/lib/api）
│   │   │   ├── pages/               # 页面（必须 React.lazy）
│   │   │   ├── components/
│   │   │   │   ├── ui/              # shadcn/ui
│   │   │   │   └── shared/          # DataTable/FilterBar/ConfirmDialog...
│   │   │   ├── layouts/             # SidebarLayout
│   │   │   ├── lib/                 # api.ts / toast.ts / menu-config.ts / utils.ts
│   │   │   ├── theme-tokens.css
│   │   │   └── design-utils.css
│   │   └── tests/
│   └── api/                 # Hono + Drizzle + bun:sqlite
│       ├── src/
│       │   ├── index.ts
│       │   ├── env.ts
│       │   ├── response.ts          # ok / fail
│       │   ├── db/
│       │   │   ├── index.ts
│       │   │   └── schema.ts
│       │   ├── middleware/
│       │   ├── routes/
│       │   └── utils/
│       └── tests/
├── packages/
│   └── shared/              # 共享类型 + 权限定义
├── mocks/                   # 统一 Mock 服务
└── scripts/
    ├── arch-check.ts        # 架构约束检查（R022-R025）
    └── check-migration-staged.ts
```

## 一键启动

```bash
bun install
bun run db:migrate
bun run dev
# web http://localhost:5173
# api http://localhost:3000
```

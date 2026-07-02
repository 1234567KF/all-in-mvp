# MVP 极简技术栈默认约束

> 所有 kf-mvp-* 技能 MUST 遵循此默认约束。除非用户显式指定，否则一律按此技术栈实现。

---

## 后端（不可协商）

| 组件 | 选型 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Node.js | >= 18 LTS | |
| 框架 | Hono | 4.x | 超轻量，TypeScript原生 |
| 数据库 | SQLite (better-sqlite3) | 11.x | 单文件，零配置 |
| ORM | Drizzle ORM | 0.36+ | 类型安全，SQL-like语法 |
| 认证 | JWT (jsonwebtoken) | 9.x | 无状态 |
| 密码 | bcryptjs | 2.x | |
| 校验 | Zod | 3.x | 请求体/参数校验 |

## 前端（不可协商）

| 组件 | 选型 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Vue 3 | 3.4+ | Composition API |
| 构建 | Vite | 5.x | |
| 路由 | Vue Router | 4.x | |
| 状态 | Pinia | 2.x | |
| HTTP | Axios | 1.x | |
| UI组件库 | shadcn/vue | latest | 默认选择 |
| 设计体系 | **Liquid Glass** | — | ★ 默认设计体系 (见 shadcn/DESIGN.md) |
| CSS框架 | Tailwind CSS v4 | 4.x | |

### 设计体系 (默认不可协商)

**所有 shadcn/vue 项目默认采用 Liquid Glass 设计体系**，除非用户显式指定其他：
- 📐 规范文档: `shadcn/DESIGN.md`
- 📁 CSS 源文件: `.qoder/skills/references/liquid-glass/` (theme-tokens.css, design-utils.css, index.css)
- 🏗️ 前端脚手架: `starters/liquid-glass-frontend/` — 复制此目录作为项目起点，含所有配置 + useTheme + 入口页
- 🎨 默认主色: Qoder 绿 `#22c55e` / `#4be277`
- 🖊️ 字体: Manrope (标题) + Inter (正文) + JetBrains Mono (数据)
- 🌙 默认主题: Dark，`.light` 类切换 Light

### UI 框架选择（按项目类型，当用户要求非 shadcn/vue 时）

| 项目类型 | 推荐 | 备选 |
|----------|------|------|
| 企业后台/B端 | Ant Design Vue | Element Plus / Arco Design |
| 通用管理/电商 | Element Plus | Ant Design Vue |
| H5移动端 | Vant | Tailwind CSS |

## 测试（不可协商）

| 层级 | 工具 | 版本 |
|------|------|------|
| 单元/集成 | Vitest | 2.x |
| E2E | Playwright | 1.x |

## 第三方服务（全部Mock）

| 服务 | Mock方式 | 切换真实 |
|------|----------|----------|
| 支付 | mockPaymentService | 替换import路径 |
| 短信 | mockSmsService | 替换import路径 |
| 存储 | 本地uploads/目录 | 替换import路径 |
| 推送 | mockPushService | 替换import路径 |

## MVP 明确不引入

- Redis / 消息队列 / 限流 / WAF
- 缓存策略 / CDN / 索引优化
- XSS/CSRF防护（JWT基础认证除外）
- 日志系统 / 监控告警
- 性能优化 / 并发控制 / 安全加固

## 项目结构

```
project/
├── backend/          # Hono + Drizzle + SQLite
│   ├── src/
│   │   ├── index.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   └── schema.ts
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── utils/
│   └── tests/
├── frontend/         # Vue 3 + Vite
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/
│   │   ├── stores/
│   │   ├── api/
│   │   ├── views/
│   │   └── components/
│   └── tests/
├── mocks/            # 统一Mock服务
└── scripts/
```

## 一键启动

```bash
npm install
npm run db:seed
npm run dev
# 后端 http://localhost:3000
# 前端 http://localhost:5173
```

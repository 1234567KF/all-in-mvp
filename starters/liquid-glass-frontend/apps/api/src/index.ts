import type { Context } from "hono"
import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { compress } from "hono/compress"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { ZodError } from "zod"

import { getDrizzle } from "./db.js"
import { users } from "./db/schema.js"
import { env } from "./env.js"
import auth from "./modules/auth/auth.route.js"
import logsRoute from "./modules/log/log.route.js"
import notificationsRoute from "./modules/notification/notification.route.js"
import usersRoute from "./modules/user/user.route.js"
import { fail, ok } from "./response.js"
import { logger, runWithLogger } from "./shared/logger.js"
import { ServiceError } from "./shared/service-error.js"
import { formatZodErrors } from "./utils/validation.js"

// [gen:module:api-route-imports] 由 bun run gen:module 追加业务模块 route import（勿手改本行）

// ─── App 构建 ────────────────────────────────────────────────────────────────
// 工厂导出：生产入口与集成测试共享同一套构建逻辑。测试若需往 app 上挂探针路由，
// 必须用 createApp() 拿独立实例——Hono 的 SmartRouter 在首个请求后会冻结路由表，
// 且 Bun test 的各测试文件共享同一模块实例，在导出的 app 单例上运行时 add route
// 会抛 "Can not add a route since the matcher is already built"。

/** 构建应用（中间件 + 路由 + 全局错误处理），每次调用返回独立实例 */
export function createApp(): Hono {
  const app = new Hono()

  // ─── Middlewares ─────────────────────────────────────────────────────────────
  // Request ID + Logger 注入（合并为单一中间件）
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") || crypto.randomUUID()
    const child = logger.child({ requestId })
    c.set("requestId", requestId)
    c.set("logger", child)
    await runWithLogger(child, next)
    c.header("X-Request-Id", requestId)
  })

  // 请求日志（仅记录慢请求和错误响应）
  app.use("*", async (c, next) => {
    const start = Date.now()
    await next()
    const duration = Date.now() - start
    const { status } = c.res
    if (status >= 500) {
      c.get("logger").error(
        { method: c.req.method, path: c.req.path, status, duration },
        "http.response.5xx"
      )
    } else if (status >= 400) {
      c.get("logger").warn(
        { method: c.req.method, path: c.req.path, status, duration },
        "http.response.4xx"
      )
    } else if (duration > 1000) {
      c.get("logger").warn(
        { method: c.req.method, path: c.req.path, status, duration },
        "http.request.slow"
      )
    }
  })

  // 安全响应头
  app.use("*", secureHeaders())
  app.use(
    "*",
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    })
  )

  // ─── Routes ──────────────────────────────────────────────────────────────────
  // 健康检查：必须真实触达 DB（容器 healthy 要以“数据库可用”为准，而不是进程活着）。
  // /api/hello 不访问 DB，不能用作 healthcheck；生产由外层 rootApp 挂到 /api/health。
  // 惰性初始化：这里才调用 getDrizzle()，模块加载阶段不碰数据库。
  app.get("/health", (c) => {
    try {
      getDrizzle().select().from(users).limit(1).all()
      return c.json({ status: "ok" } as const, 200)
    } catch (err) {
      c.get("logger").error({ err }, "health.db.unavailable")
      return fail(c, 503, "SERVICE_UNAVAILABLE", "Database unavailable")
    }
  })

  app.get("/hello", (c) => {
    return ok(
      c,
      { timestamp: new Date().toISOString() },
      "Hello from Liquid Glass Hono Backend!"
    )
  })

  app.route("/auth", auth)
  app.route("/users", usersRoute)
  app.route("/notifications", notificationsRoute)
  app.route("/logs", logsRoute)
  // [gen:module:api-route-mounts] 由 bun run gen:module 追加业务模块路由挂载（勿手改本行）

  // 全局错误处理（globalErrorHandler 定义见下方；函数声明提升，运行期可用）
  app.onError(globalErrorHandler)

  return app
}

// ─── Global Error Handler ────────────────────────────────────────────────────
// 独立成可导出的函数，便于单元测试直接对最小 Hono app 注册（见 error-handler.test.ts）。
/**
 * 全局错误处理器：把 handler / service 抛出的错误统一映射为 fail() 响应。
 *
 * 判定顺序（先具体后兜底）：
 * 1. ServiceError——领域错误自带 status/code，属于预期分支；只读 handler 省略
 *    try/catch 时抛出的 403/404/409 也能正确透出，不再被误兜底成 500。
 *    不记 "http.request.unhandled"（请求日志中间件已按响应码记录 4xx/5xx）。
 * 2. ZodError——请求参数校验失败，400 + VALIDATION_ERROR；顶层 message 与 route 层
 *    保持同一中文口径（「请求参数校验失败」），字段错误经 formatZodErrors 转成与
 *    route 层一致的**扁平**形状（`{ field: "message" }`），前端
 *    applyServerFieldErrors 才能直接回填、默认 mutation Toast 也不会显示英文。
 *    同样是预期分支，不记 unhandled。
 * 3. 其它——未知异常，error 级日志 + 500 兜底，且不回显内部信息。
 */
export function globalErrorHandler(err: Error, c: Context): Response {
  if (err instanceof ServiceError) {
    // ServiceError.status 本身即合法 ContentfulStatusCode；code 为空时 fail()
    // 会按 status 回退到默认错误码（如 409 → CONFLICT）。
    const status: ContentfulStatusCode = err.status
    return fail(c, status, err.code, err.message)
  }

  if (err instanceof ZodError) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      "请求参数校验失败",
      formatZodErrors({ success: false, error: err })
    )
  }

  c.get("logger").error(
    { err, method: c.req.method, path: c.req.path },
    "http.request.unhandled"
  )
  return fail(c, 500, "INTERNAL_ERROR", "An unexpected error occurred")
}

// 导出 app 单例供集成测试（如 /health 冒烟）直接发请求；生产入口见文件末尾 default export
export const app = createApp()

// 导出类型供前端 Hono RPC 客户端使用
export type AppRoutes = typeof app

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// 使用 Bun 原生 HTTP 服务器（`export default { port, fetch }`），
// 而非 `@hono/node-server`：因为生产镜像通过 `bun build --compile` 出的独立
// 二进制不含 Node.js runtime，Node 适配器 shim 会引出兼容坑。Bun 原生方式
// 同时兼容 `bun run dev`、`bun test`、以及 compile 后的可执行文件。

const port = env.PORT

logger.info(
  { port, env: process.env.NODE_ENV ?? "development", cwd: process.cwd() },
  "server.started"
)

// ─── 生产环境：Hono 直接托管前端静态文件（替代 nginx）──────────────────────────
// 触发条件：`NODE_ENV=production` 或 `SERVE_STATIC=true`
// 开发环境前端走 Vite dev server（含 /api 代理），此分支不生效。
//
// 目录约定（配合 Dockerfile COPY 布局）：
//   /app/server            ← bun build --compile 输出
//   /app/web/index.html    ← 前端 dist
//   /app/db-bootstrap/     ← init.sql（模板）或 drizzle/（生成项目）
//
// 若不启用本分支，容器起来后 `/api/*` 通、但 `/` 是 404 —— 部署直接崩。
const serveStaticEnabled =
  process.env.NODE_ENV === "production" || process.env.SERVE_STATIC === "true"

let fetchHandler: (req: Request) => Response | Promise<Response> = app.fetch

if (serveStaticEnabled) {
  const rootApp = new Hono()
  logger.info({ root: `${process.cwd()}/web` }, "static.serving.enabled")

  // API 路由优先（`/api/*` 前缀），避免与前端 SPA 路由冲突
  rootApp.route("/api", app)

  // gzip 压缩静态资源
  rootApp.use("*", compress())

  // 前端静态资源
  rootApp.use("/*", serveStatic({ root: "./web" }))

  // SPA fallback：所有未匹配路径都回 index.html
  rootApp.get("*", serveStatic({ path: "./web/index.html" }))

  fetchHandler = (req: Request) => rootApp.fetch(req)
}

export default {
  port,
  fetch: fetchHandler,
  // Bun 默认 idleTimeout 为 10s，小于 SSE 心跳间隔（25s），会周期性掐断
  // SSE 长连接（表现为 Vite 代理 socket hang up + 前端反复重连）。
  // 提高到 120s：远大于心跳间隔，同时保留死连接清理能力。
  idleTimeout: 120,
}

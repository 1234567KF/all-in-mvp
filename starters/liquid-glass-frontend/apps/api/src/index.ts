import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { compress } from "hono/compress"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { ZodError } from "zod"

import { getDrizzle } from "./db.js"
import { users } from "./db/schema.js"
import { env } from "./env.js"
import auth from "./modules/auth/auth.route.js"
import notificationsRoute from "./modules/notification/notification.route.js"
import usersRoute from "./modules/user/user.route.js"
import { fail, ok } from "./response.js"
import { logger, runWithLogger } from "./shared/logger.js"

// 导出 app 供集成测试（如 /health 冒烟）直接发请求；生产入口见文件末尾 default export
export const app = new Hono()

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

// ─── Global Error Handler ────────────────────────────────────────────────────
app.onError((err, c) => {
  c.get("logger").error(
    { err, method: c.req.method, path: c.req.path },
    "http.request.unhandled"
  )
  if (err instanceof ZodError) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      err.format() as unknown as Record<string, unknown>
    )
  }
  return fail(c, 500, "INTERNAL_ERROR", "An unexpected error occurred")
})

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

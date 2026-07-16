import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { compress } from "hono/compress"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { ZodError } from "zod"

import { env } from "./env.js"
import { fail, ok } from "./response.js"
import auth from "./routes/auth.js"
import usersRoute from "./routes/users.js"

const app = new Hono()

// ─── Middlewares ─────────────────────────────────────────────────────────────
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
app.get("/hello", (c) => {
  return ok(
    c,
    { timestamp: new Date().toISOString() },
    "Hello from Liquid Glass Hono Backend!"
  )
})

app.route("/auth", auth)
app.route("/users", usersRoute)

// ─── Global Error Handler ────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("[API Error]", err)
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

console.log(`🚀 API Server is running on http://localhost:${port}`)
console.log(
  `   ENV=${process.env.NODE_ENV ?? "development"} | CWD=${process.cwd()}`
)

// ─── 生产环境：Hono 直接托管前端静态文件（替代 nginx）──────────────────────────
// 触发条件：`NODE_ENV=production` 或 `SERVE_STATIC=true`
// 开发环境前端走 Vite dev server（含 /api 代理），此分支不生效。
//
// 目录约定（配合 Dockerfile COPY 布局）：
//   /app/server            ← bun build --compile 输出
//   /app/web/index.html    ← 前端 dist
//   /app/drizzle/          ← 迁移文件
//
// 若不启用本分支，容器起来后 `/api/*` 通、但 `/` 是 404 —— 部署直接崩。
const serveStaticEnabled =
  process.env.NODE_ENV === "production" || process.env.SERVE_STATIC === "true"

let fetchHandler: (req: Request) => Response | Promise<Response> = app.fetch

if (serveStaticEnabled) {
  const rootApp = new Hono()
  console.log(`📂 Serving static files from: ${process.cwd()}/web`)

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
}

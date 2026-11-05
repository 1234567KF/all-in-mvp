/**
 * 全局错误处理器（globalErrorHandler）单元测试
 *
 * 覆盖 index.ts 抽出并注册到 app.onError 的兜底逻辑：
 * - ServiceError / 内置子类 → 按自带 status/code/message 透出，success=false
 * - ZodError → 400 + VALIDATION_ERROR + **扁平**字段级 errors（与 route 层
 *   formatZodErrors 同形，前端 applyServerFieldErrors 可直接回填）
 * - 未知异常 → 500 + INTERNAL_ERROR，不回显内部信息
 * - 预期分支（ServiceError / ZodError）不写 "http.request.unhandled" error 日志
 * - 真实 app（index.ts 导出的 app）确实注册了 globalErrorHandler（防误删注册）
 *
 * import index.js 会执行模块顶层启动日志（与 index.test.ts 相同的既有先例）；
 * 最小 app 用例用内存收集型 pino 便于断言，真实 app 用例走默认 pino 输出。
 * 运行方式：bun test src/error-handler.test.ts
 */
import { describe, expect, it } from "bun:test"
import { Hono } from "hono"
import pino, { type Logger } from "pino"
import { z } from "zod"

import { createApp, globalErrorHandler } from "./index.js"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceError,
  ValidationError,
} from "./shared/service-error.js"

// ── 断言用响应结构 ────────────────────────────────────────────────────────────

interface ErrorBody {
  success: boolean
  code: string
  message?: string
  requestId?: string
  errors?: Record<string, unknown>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 内存收集型 logger：pino 结构化日志写进数组，不输出到 stdout 便于断言 */
function createCapturingLogger(): {
  logger: Logger
  entries: Record<string, unknown>[]
} {
  const entries: Record<string, unknown>[] = []
  const logger: Logger = pino(
    { level: "info" },
    {
      write(msg: string) {
        entries.push(JSON.parse(msg) as Record<string, unknown>)
      },
    }
  )
  return { logger, entries }
}

/**
 * 最小 Hono app：注入 requestId / logger（与 index.ts 的请求中间件同一套
 * Context 变量契约），注册待测全局错误处理器，唯一路由直接抛出给定错误。
 */
function createFailingApp(thrown: Error, logger: Logger) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("requestId", "test-request-id")
    c.set("logger", logger)
    await next()
  })
  app.onError(globalErrorHandler)
  app.get("/boom", () => {
    throw thrown
  })
  return app
}

/** 发一次必然报错的请求，返回响应与本次捕获到的日志 */
async function request(thrown: Error) {
  const { logger, entries } = createCapturingLogger()
  const res = await createFailingApp(thrown, logger).request("/boom")
  const body = (await res.json()) as ErrorBody
  return { status: res.status, body, logs: entries }
}

/** 由真实 Zod 校验失败构造 ZodError（避免手工拼 issues） */
function makeZodError(): z.ZodError {
  const result = z
    .object({
      name: z.string().min(2, "名字至少2个字符"),
      email: z.string().email("邮箱格式不正确"),
    })
    .safeParse({ name: "a", email: "not-email" })
  if (result.success) throw new Error("测试 schema 应当校验失败")
  return result.error
}

// ── ServiceError ─────────────────────────────────────────────────────────────

describe("globalErrorHandler — ServiceError", () => {
  it("403/404/409/400（带自定义 code）按自带 status/code/message 透出", async () => {
    const cases: [ServiceError, number, string][] = [
      [
        new ServiceError("无权限操作", 403, "USER_FORBIDDEN"),
        403,
        "USER_FORBIDDEN",
      ],
      [
        new ServiceError("用户不存在", 404, "USER_NOT_FOUND"),
        404,
        "USER_NOT_FOUND",
      ],
      [
        new ServiceError("用户名已存在", 409, "USERNAME_TAKEN"),
        409,
        "USERNAME_TAKEN",
      ],
      [
        new ServiceError("参数不合法", 400, "INVALID_PARAM"),
        400,
        "INVALID_PARAM",
      ],
    ]
    for (const [err, status, code] of cases) {
      const { status: actualStatus, body } = await request(err)
      expect(actualStatus).toBe(status)
      expect(body.success).toBe(false)
      expect(body.code).toBe(code)
      expect(body.message).toBe(err.message)
      expect(body.requestId).toBe("test-request-id")
    }
  })

  it("内置子类（Forbidden/NotFound/Conflict/Validation）携带对应 status 与 code", async () => {
    const cases: [ServiceError, number, string][] = [
      [new ForbiddenError(), 403, "FORBIDDEN"],
      [new NotFoundError(), 404, "NOT_FOUND"],
      [new ConflictError(), 409, "CONFLICT"],
      [new ValidationError(), 400, "VALIDATION"],
    ]
    for (const [err, status, code] of cases) {
      const { status: actualStatus, body } = await request(err)
      expect(actualStatus).toBe(status)
      expect(body.code).toBe(code)
      expect(body.message).toBe(err.message)
    }
  })

  it("无 code 的 ServiceError 回退 fail() 按 status 推导的默认 code", async () => {
    const { status, body } = await request(new ServiceError("冲突", 409))
    expect(status).toBe(409)
    expect(body.code).toBe("CONFLICT")
  })

  it("属于预期分支：不写 'http.request.unhandled' error 日志", async () => {
    const { status, logs } = await request(new NotFoundError())
    expect(status).toBe(404)
    expect(logs.some((entry) => entry.msg === "http.request.unhandled")).toBe(
      false
    )
  })
})

// ── ZodError ─────────────────────────────────────────────────────────────────

describe("globalErrorHandler — ZodError", () => {
  it("400 + VALIDATION_ERROR + 扁平字段级 errors（与 route formatZodErrors 同形）", async () => {
    const { status, body } = await request(makeZodError())
    expect(status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.message).toBe("请求参数校验失败")
    // 扁平形状：字段名 → 首条可读错误；前端 applyServerFieldErrors 可直接回填
    expect(body.errors).toEqual({
      name: "名字至少2个字符",
      email: "邮箱格式不正确",
    })
  })

  it("属于预期分支：不写 'http.request.unhandled' error 日志", async () => {
    const { logs } = await request(makeZodError())
    expect(logs.some((entry) => entry.msg === "http.request.unhandled")).toBe(
      false
    )
  })
})

// ── 未知异常 ─────────────────────────────────────────────────────────────────

describe("globalErrorHandler — 未知异常", () => {
  it("500 + INTERNAL_ERROR，不回显内部信息", async () => {
    const { status, body } = await request(
      new Error("SQLITE_BUSY: database is locked")
    )
    expect(status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.code).toBe("INTERNAL_ERROR")
    expect(body.message).toBe("An unexpected error occurred")
    expect(body.message).not.toContain("SQLITE_BUSY")
    expect(JSON.stringify(body)).not.toContain("database is locked")
  })

  it("写入 'http.request.unhandled' error 日志（level 50）便于排障", async () => {
    const { logs } = await request(new Error("boom"))
    const unhandled = logs.find(
      (entry) => entry.msg === "http.request.unhandled"
    )
    expect(unhandled).toBeDefined()
    expect(unhandled?.level).toBe(50)
  })
})

// ── 真实 app 的 onError 注册（防止 createApp 里的注册被误删）──────────────────
// 不往导出的 app 单例上挂临时路由：Bun test 各文件共享模块实例，且 Hono 的
// SmartRouter 在首个请求后会冻结路由表，运行时 add route 会抛
// "Can not add a route since the matcher is already built"。
// 这里用 createApp() 构建独立实例（真实中间件链 + 真实错误处理注册）再挂探针路由。

describe("真实 app 的 onError 注册", () => {
  it("createApp() 构建的应用栈上，ServiceError 按自带 status/code/message 返回", async () => {
    const testApp = createApp()
    testApp.get("/__error-handler-test/forbidden", () => {
      throw new ForbiddenError()
    })

    const res = await testApp.request("/__error-handler-test/forbidden")
    expect(res.status).toBe(403)
    const body = (await res.json()) as ErrorBody
    expect(body.success).toBe(false)
    expect(body.code).toBe("FORBIDDEN")
    expect(body.message).toBe("无权限操作")
    // 真实请求中间件链生效：requestId 由第一个 * 中间件注入
    expect(body.requestId).toBeTruthy()
  })
})

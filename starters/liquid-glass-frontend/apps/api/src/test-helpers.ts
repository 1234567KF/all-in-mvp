/**
 * API 集成测试工具
 *
 * 提供内存 SQLite 初始化、HTTP 请求辅助、登录获取 token。
 *
 * 用法：
 *   import { setupTestDb, request, postJson, getAuthToken, ADMIN_CREDENTIALS } from "../test-helpers.js"
 *
 *   // 在 beforeAll 中初始化内存 DB
 *   let app: Hono
 *   beforeAll(() => {
 *     setupTestDb()
 *     app = createApp() // 或直接 import app
 *   })
 */
import { Database } from "bun:sqlite"
import type { Hono } from "hono"
import path from "path"

import { _setTestDb } from "./db.js"
import { bootstrapDatabase } from "./db/bootstrap.js"
import { createDrizzleDb, type DrizzleDB } from "./db/index.js"
import { DEV_SEED_PASSWORD } from "./db/seed-users.js"

/** apps/api 根目录：模板模式读 init.sql，生成项目模式读 drizzle/ */
const apiRoot = path.resolve(import.meta.dir, "..")

// ─── 内存 DB 初始化 ──────────────────────────────────────────────────────────

/** 创建内存 SQLite + 执行迁移，注入为全局 DB（无种子数据） */
export function setupTestDb(): DrizzleDB {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA journal_mode = WAL")
  const d = createDrizzleDb(sqlite)
  bootstrapDatabase(sqlite, d, { baseDir: apiRoot })
  _setTestDb(d)
  return d
}

// ─── 请求辅助函数 ────────────────────────────────────────────────────────────

/** 通用请求 → JSON 响应 */
export async function request(
  app: Hono,
  method: string,
  url: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {}
  if (body) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await app.request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

/** GET 请求 */
export const get = (app: Hono, url: string, token?: string) =>
  request(app, "GET", url, undefined, token)

/** POST JSON 请求 */
export const postJson = (
  app: Hono,
  url: string,
  body: unknown,
  token?: string
) => request(app, "POST", url, body, token)

/** PUT JSON 请求 */
export const putJson = (
  app: Hono,
  url: string,
  body: unknown,
  token?: string
) => request(app, "PUT", url, body, token)

/** PATCH 请求 */
export const patchJson = (
  app: Hono,
  url: string,
  body?: unknown,
  token?: string
) => request(app, "PATCH", url, body, token)

/** DELETE 请求 */
export const deleteRequest = (app: Hono, url: string, token?: string) =>
  request(app, "DELETE", url, undefined, token)

// ─── 登录获取 Token ──────────────────────────────────────────────────────────

/** 通过 /auth/login 获取 JWT accessToken */
export async function getAuthToken(
  app: Hono,
  email: string,
  password: string
): Promise<string> {
  const { body } = await postJson(app, "/auth/login", { email, password })
  const data = body.data as Record<string, unknown> | undefined
  const token = data?.accessToken as string
  if (!token) throw new Error(`登录失败: ${body.message || "unknown"}`)
  return token
}

// ─── 预置凭据 ────────────────────────────────────────────────────────────────

/** 与种子真源同款口令（db/seed-users.ts），改一处即可，避免测试凭据漂移 */
export const ADMIN_CREDENTIALS = {
  email: "admin",
  password: DEV_SEED_PASSWORD,
}

/**
 * /health 冒烟测试
 *
 * compose.self.yml / compose.test.yml 的 healthcheck 打 /api/health（生产挂载前缀），
 * 该端点必须真实触达数据库：/api/hello 不访问 DB，数据库/初始化失败时容器会
 * 假 healthy，deploy.sh 也会误报部署成功。这里验证路由存在且 DB 可用时返回 200。
 */
import { beforeAll, describe, expect, it } from "bun:test"

import { app } from "./index.js"
import { setupTestDb } from "./test-helpers.js"

describe("GET /health", () => {
  beforeAll(() => {
    setupTestDb()
  })

  it("DB 可用 → 200 { status: 'ok' }", async () => {
    const res = await app.request("/health")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok" })
  })
})

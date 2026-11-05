import { describe, expect, it } from "bun:test"
import { Hono } from "hono"

import { safeJson } from "./safe-json.js"

describe("safeJson", () => {
  const app = new Hono()
  app.post("/json", async (c) => {
    const body = await safeJson(c)
    if (body === undefined) {
      return c.json({ error: "invalid" }, 400)
    }
    return c.json({ data: body })
  })

  it("合法 JSON — 正常解析", async () => {
    const res = await app.request("/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { name: "test" } })
  })

  it("畸形 JSON — 返回 undefined（走 catch 分支）", async () => {
    const res = await app.request("/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json!!!",
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "invalid" })
  })

  it("空 body — 返回 undefined", async () => {
    const res = await app.request("/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    })
    expect(res.status).toBe(400)
  })
})

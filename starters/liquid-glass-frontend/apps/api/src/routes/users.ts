import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { getDrizzle } from "../db.js"
import { users } from "../db/schema.js"
import { authMiddleware, type JwtPayload } from "../middleware/auth.js"
import { fail, ok } from "../response.js"

const usersRoute = new Hono()

// 所有 /users 路由需要认证
usersRoute.use("*", authMiddleware)

// GET /users/me — 获取当前用户信息
usersRoute.get("/me", async (c) => {
  const payload = c.get("user" as never) as JwtPayload
  try {
    const user = getDrizzle()
      .select()
      .from(users)
      .where(eq(users.email, payload.sub))
      .get()
    if (!user) {
      return fail(c, 404, "USER_NOT_FOUND", "用户不存在")
    }
    return ok(c, { user })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return fail(c, 500, "INTERNAL_ERROR", msg)
  }
})

// PUT /users/me — 更新当前用户信息
const UpdateMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
})

usersRoute.put("/me", async (c) => {
  const payload = c.get("user" as never) as JwtPayload
  const body = await c.req.json()
  const result = UpdateMeSchema.safeParse(body)

  if (!result.success) {
    return fail(
      c,
      400,
      "VALIDATION_ERROR",
      "请求参数校验失败",
      result.error.format() as unknown as Record<string, unknown>
    )
  }

  try {
    const updated = getDrizzle()
      .update(users)
      .set(result.data)
      .where(eq(users.email, payload.sub))
      .returning()
      .get()
    if (!updated) {
      return fail(c, 404, "USER_NOT_FOUND", "用户不存在")
    }
    return ok(c, { user: updated }, "更新成功")
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return fail(c, 500, "INTERNAL_ERROR", msg)
  }
})

export default usersRoute

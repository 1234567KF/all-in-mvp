import { eq } from "drizzle-orm"
import { Hono } from "hono"
import jwt from "jsonwebtoken"
import { LoginSchema } from "shared"

import { getDrizzle } from "../db.js"
import { users } from "../db/schema.js"
import { JWT_SECRET } from "../middleware/auth.js"
import { fail, ok } from "../response.js"

const auth = new Hono()

// ─── Token Helpers ───────────────────────────────────────────────────────────

// 种子项目：使用内存 Map 关联 refreshToken 与用户账号
type RefreshedUser = { name: string | null; email: string; role: string | null }
const refreshTokenStore = new Map<string, RefreshedUser>()

function issueTokens(user: RefreshedUser) {
  const accessToken = jwt.sign(
    {
      sub: user.email,
      username: user.name ?? user.email,
      role: user.role ?? "user",
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  )
  const refreshToken = `demo-refresh-${Date.now()}`
  refreshTokenStore.set(refreshToken, user)
  return { accessToken, refreshToken }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

auth.post("/login", async (c) => {
  const body = await c.req.json()
  const result = LoginSchema.safeParse(body)

  if (!result.success) {
    const issues = result.error.issues
    const fieldMessages: string[] = issues.map((issue) => {
      if (issue.path.includes("email")) return "请输入账号"
      if (issue.path.includes("password")) {
        if (issue.code === "too_small") return "密码至少需要 6 位"
        return "密码格式不正确"
      }
      return issue.message
    })
    const message = fieldMessages[0] || "请求参数校验失败"
    return fail(c, 400, "VALIDATION_ERROR", message)
  }

  // 先从数据库中查找用户
  const dbUser = getDrizzle()
    .select()
    .from(users)
    .where(eq(users.email, result.data.email))
    .get()

  if (dbUser) {
    const user = { name: dbUser.name, email: dbUser.email, role: dbUser.role }
    return ok(c, { ...issueTokens(user), user }, "登录成功")
  }

  // Fallback: Demo 模式
  const user = {
    name: result.data.email.split("@")[0],
    email: result.data.email,
    role: "user",
  }
  return ok(c, { ...issueTokens(user), user }, "登录成功")
})

auth.post("/refresh", async (c) => {
  const body = await c.req.json().catch(() => null)
  const refreshToken = body?.refreshToken

  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    return fail(c, 401, "TOKEN_EXPIRED", "refreshToken 无效或已过期")
  }

  const user = refreshTokenStore.get(refreshToken)
  if (!user) {
    return fail(c, 401, "TOKEN_EXPIRED", "refreshToken 无效或已过期")
  }

  // 旋转：作废旧 refreshToken，签发新的 token 对
  refreshTokenStore.delete(refreshToken)
  return ok(c, issueTokens(user), "刷新成功")
})

export default auth

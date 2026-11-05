/**
 * 用户 — 前后端共享契约（api / web 共用单一事实源）
 *
 * 设计边界（沉淀原则）：
 * - 只描述 users 表对外的 wire 形状，不引入手机号登录、密码重置等重度业务字段，
 *   保持 Starter 现有极简 users 表可被企微 / 飞书 / SSO 等登录方式替换；
 * - `id` / `createdAt` 可选：POST /auth/login 返回的会话用户不带主键与创建时间
 *   （GET /users/me 返回完整 DB 行），前端不应强依赖这两个字段；
 * - `email` 只做非空校验、不使用 `z.email()`：demo 种子账号可能是 "admin" 这类
 *   非邮箱格式的登录名（见 DEMO_MODE）；
 * - `name` 的 key 必存在但允许为 null（DB 列可空，展示占位由调用方兜底）。
 */
import { z } from "zod"

/** 用户 wire schema（GET /users/me 的 DB 行 / POST /auth/login 的会话用户共用） */
export const UserSchema = z.object({
  /** 主键；POST /auth/login 的会话用户不返回，故可选 */
  id: z.number().int().positive().optional(),
  /** 登录账号；demo 账号可能是 "admin"，禁止用 z.email() */
  email: z.string().min(1),
  /** 姓名：key 必有，DB 允许 null */
  name: z.string().nullable(),
  /** 角色标识；权限体系未启用时可缺省 */
  role: z.string().nullable().optional(),
  /** 扁平权限码数组；未接入权限体系时缺省 */
  permissions: z.array(z.string()).optional(),
  /** 创建时间（ISO 字符串）；POST /auth/login 的会话用户不返回，故可选 */
  createdAt: z.string().nullable().optional(),
})

export type User = z.infer<typeof UserSchema>

/**
 * 更新当前用户入参（PUT /users/me）
 *
 * 仅允许改 name：邮箱是 JWT sub 的签发依据，变更需走独立安全流程；
 * `.refine()` 防止空 body 透传至 Drizzle 生成无效 SQL。refine 错误由 route 的
 * formatZodErrors 收进 `errors._form`，前端 applyServerFieldErrors 会挂到表单根。
 */
export const UpdateMeSchema = z
  .object({
    name: z.string().min(1).optional(),
  })
  .refine((d) => d.name !== undefined, {
    message: "至少提供一个要更新的字段",
  })

export type UpdateMeInput = z.infer<typeof UpdateMeSchema>

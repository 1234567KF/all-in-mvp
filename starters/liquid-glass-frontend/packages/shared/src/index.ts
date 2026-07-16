import { z } from 'zod'

// Shared Login validation schema
export const LoginSchema = z.object({
  email: z.string().min(1, '请输入账号'),
  password: z.string().min(6, '密码长度至少为 6 位 (Password must be at least 6 characters)')
})

export type LoginInput = z.infer<typeof LoginSchema>

export { type ApiResponse } from "./response.js"
export { PERMISSIONS, type Permission, ROLE_PERMISSIONS } from "./permissions.js"

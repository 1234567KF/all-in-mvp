/**
 * Users service — 封装 /users API 调用
 * 端点见 apps/api/src/modules/user/user.route.ts（GET/PUT /users/me，信封 {success,message,data}）
 */
import { api } from "@/lib/api"

export interface User {
  id: number
  email: string
  name: string | null
  role: string | null
  createdAt: string | null
}

export interface UpdateMeInput {
  name?: string
}

export const usersService = {
  /** 获取当前登录用户信息 */
  me: async (): Promise<User> => {
    const res = await api.get("/users/me")
    return res.data.data.user
  },

  /** 更新当前登录用户信息 */
  updateMe: async (data: UpdateMeInput): Promise<User> => {
    const res = await api.put("/users/me", data)
    return res.data.data.user
  },
}

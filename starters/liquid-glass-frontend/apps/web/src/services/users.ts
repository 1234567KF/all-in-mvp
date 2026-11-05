/**
 * Users service — 封装 /users API 调用
 * 端点见 apps/api/src/modules/user/user.route.ts（GET/PUT /users/me，信封 {success,message,data}）
 * 类型契约统一来自 shared（packages/shared/src/user.ts），禁止在此重复手写 interface
 */
import type { UpdateMeInput, User } from "shared"

import { api } from "@/lib/api"

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

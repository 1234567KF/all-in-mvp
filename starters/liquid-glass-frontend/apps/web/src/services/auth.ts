/**
 * Auth service — 封装 /auth API 调用
 * 端点见 apps/api/src/modules/auth/auth.route.ts（POST /auth/login、/auth/refresh）
 * 类型契约统一来自 shared（LoginInput / User），禁止在此重复手写 interface
 */
import type { LoginInput, User } from "shared"

import { api } from "@/lib/api"

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  /**
   * 登录会话用户；permissions 由后端按 role 解析后下发（string[]），
   * 前端权限门控只消费该数组，不自行推导角色 → 权限
   */
  user: User
}

export async function login(data: LoginInput): Promise<LoginResponse> {
  const res = await api.post("/auth/login", data)
  return res.data.data
}

export interface ChangePasswordInput {
  oldPassword: string
  newPassword: string
}

export async function changePassword(data: ChangePasswordInput): Promise<void> {
  await api.post("/api/auth/change-password", data)
}

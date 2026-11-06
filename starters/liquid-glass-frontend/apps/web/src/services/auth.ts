/**
 * Auth service — 封装 /auth API 调用
 * 端点见 apps/api/src/modules/auth/auth.route.ts
 * （POST /auth/login、/auth/refresh、/auth/change-password）
 * 请求体类型契约统一来自 shared（LoginInput / ChangePasswordInput / User），
 * 禁止在此重复手写请求侧 interface；LoginResponse 是响应形状，shared 暂未定义，
 * 保持原样（如需收敛，应加到 shared 而不是留在这里）
 *
 * 路径约定：一律写「后端挂载路径」（不含 /api 前缀）。api client 的 BASE_URL
 * 在开发期是 VITE_API_BASE_URL（后端根路径），在生产同域托管时是 /api；
 * 手工再写一次 /api 会在两种环境下分别变成 /api/... 与 /api/api/...（404）。
 */
import type { ChangePasswordInput, LoginInput, User } from "shared"

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

export async function changePassword(data: ChangePasswordInput): Promise<void> {
  await api.post("/auth/change-password", data)
}

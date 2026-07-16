import { api } from "@/lib/api"

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: { name: string; email: string }
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

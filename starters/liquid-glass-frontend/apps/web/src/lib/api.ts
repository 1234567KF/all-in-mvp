/**
 * API Client — parameterised skeleton for liquid-glass-starter seed project.
 * Changes:
 *   - baseURL reads from VITE_API_BASE_URL env var, falls back to "/api"
 *   - refresh endpoint path parameterised via VITE_AUTH_REFRESH_PATH
 *   - kept: Axios instance, request interceptor (Bearer token),
 *     response interceptor (401 refresh) with isRefreshing + failedQueue queue
 */
import axios from "axios"

import { useAuthStore } from "@/stores/auth"

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api"
const REFRESH_PATH = import.meta.env.VITE_AUTH_REFRESH_PATH || "/auth/refresh"

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Response interceptor: token refresh logic
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token)
    } else {
      promise.reject(error)
    }
  })
  failedQueue = []
}

/**
 * Perform a token refresh using the current refreshToken.
 * Coordinates concurrent callers via isRefreshing + failedQueue so only one
 * network refresh happens at a time. Returns the new accessToken.
 * Uses a bare axios instance to avoid recursing through these interceptors.
 */
export async function refreshAccessToken(): Promise<string> {
  const { refreshToken, user, clearAuth, setAuth } = useAuthStore.getState()

  if (!refreshToken) {
    clearAuth()
    throw new Error("Session expired")
  }

  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    })
  }

  isRefreshing = true
  try {
    const response = await axios.post(`${BASE_URL}${REFRESH_PATH}`, {
      refreshToken,
    })
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      response.data.data

    setAuth({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: user!,
    })

    processQueue(null, newAccessToken)
    return newAccessToken
  } catch (refreshError) {
    processQueue(refreshError, null)
    clearAuth()
    throw refreshError
  } finally {
    isRefreshing = false
  }
}

// Request interceptor: inject Authorization header, silently restoring the
// in-memory accessToken from refreshToken when it is missing (e.g. after a
// page refresh).
api.interceptors.request.use(async (config) => {
  // Never attach/refresh tokens for the auth endpoints themselves.
  const isAuthEndpoint =
    config.url?.includes("/auth/login") || config.url?.includes(REFRESH_PATH)
  if (isAuthEndpoint) {
    return config
  }

  let token = useAuthStore.getState().accessToken

  if (!token && useAuthStore.getState().refreshToken) {
    try {
      token = await refreshAccessToken()
    } catch {
      window.location.href = "/login"
      return Promise.reject(new Error("Session expired"))
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh logic for auth endpoints
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes(REFRESH_PATH)

    if (
      isAuthEndpoint ||
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(error)
    }

    if (!useAuthStore.getState().refreshToken) {
      useAuthStore.getState().clearAuth()
      window.location.href = "/login"
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const newAccessToken = await refreshAccessToken()
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      window.location.href = "/login"
      return Promise.reject(refreshError)
    }
  }
)

export default api

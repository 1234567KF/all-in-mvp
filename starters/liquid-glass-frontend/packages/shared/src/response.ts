export type ApiResponse<T = unknown> = {
  success: boolean
  requestId?: string
  message?: string
  data?: T
  errors?: Record<string, unknown>
}

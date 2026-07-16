export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, unknown>
}

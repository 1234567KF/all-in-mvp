import { z } from "zod"

// Shared Login validation schema
export const LoginSchema = z.object({
  email: z.string().min(1, "请输入账号"),
  password: z
    .string()
    .min(6, "密码长度至少为 6 位 (Password must be at least 6 characters)"),
})

export type LoginInput = z.infer<typeof LoginSchema>

export { type ApiResponse } from "./response.js"

// ─── 消息通知（业务无关通用契约）─────────────────────────────────────────────
export {
  type Notification,
  NOTIFICATION_STREAM_EVENT,
  type NotificationListQuery,
  NotificationListQuerySchema,
  type NotificationPage,
  NotificationPageSchema,
  NotificationSchema,
  type NotificationUnreadCount,
  NotificationUnreadCountSchema,
} from "./notification.js"

// ─── 权限 ─────────────────────────────────────────────────────────────────────
export {
  ALL_PERMISSIONS,
  buildPermissionTree,
  type Permission,
  PERMISSION_REGISTRY,
  type PermissionCode,
  type PermissionDef,
  PERMISSIONS,
  type PermissionTreeGroup,
  ROLE_PERMISSIONS,
} from "./permissions.js"

// ─── 审计日志 ─────────────────────────────────────────────────────────────────
export {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_EVENT_TYPES,
  AUDIT_MODULE_LABELS,
  AUDIT_MODULES,
  AUDIT_RESULT,
  AUDIT_RESULT_LABELS,
  type AuditEventType,
  type AuditModule,
  type AuditResult,
} from "./audit.js"

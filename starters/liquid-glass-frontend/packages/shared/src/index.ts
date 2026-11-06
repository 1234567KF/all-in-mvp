import { z } from "zod"

// Shared Login validation schema
export const LoginSchema = z.object({
  email: z.string().min(1, "请输入账号"),
  password: z
    .string()
    .min(6, "密码长度至少为 6 位 (Password must be at least 6 characters)"),
})

export type LoginInput = z.infer<typeof LoginSchema>

/**
 * 修改密码入参（POST /auth/change-password）
 *
 * 放在 shared 而不是只写在前端 service 里：前端手写 interface 会与后端校验漂移
 * （starter 曾出现过只在前端定义、后端无端点的孤儿契约）。
 * 长度下限与 LoginSchema 一致，避免「改完后下次登录直接过不了校验」。
 */
export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "请输入原密码"),
    newPassword: z
      .string()
      .min(6, "密码长度至少为 6 位 (Password must be at least 6 characters)"),
  })
  .refine((d) => d.oldPassword !== d.newPassword, {
    message: "新密码不能与原密码相同",
    path: ["newPassword"],
  })

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>

export { type ApiResponse } from "./response.js"

// ─── 通用分页（业务无关契约）──────────────────────────────────────────────────
export {
  type PagedResult,
  type PageQuery,
  PageQueryBaseSchema,
  PageQuerySchema,
  stripBlankQueryValues,
} from "./pagination.js"

// ─── 用户（前后端共享契约）────────────────────────────────────────────────────
export {
  type UpdateMeInput,
  UpdateMeSchema,
  type User,
  UserSchema,
} from "./user.js"

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
  DEFAULT_ROLE,
  type Permission,
  PERMISSION_REGISTRY,
  type PermissionCode,
  type PermissionDef,
  PERMISSIONS,
  permissionsForRole,
  type PermissionTreeGroup,
  ROLE_PERMISSIONS,
} from "./permissions.js"

// ─── 审计日志 ─────────────────────────────────────────────────────────────────
export {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_EVENT_TYPE_OPTIONS,
  AUDIT_EVENT_TYPES,
  AUDIT_MODULE_LABELS,
  AUDIT_MODULE_OPTIONS,
  AUDIT_MODULES,
  AUDIT_RESULT,
  AUDIT_RESULT_LABELS,
  AUDIT_RESULT_OPTIONS,
  AUDIT_SEVERITY,
  AUDIT_SEVERITY_LABELS,
  AUDIT_SEVERITY_OPTIONS,
  type AuditChangeEntry,
  type AuditChanges,
  AuditChangesSchema,
  type AuditEventType,
  type AuditLog,
  type AuditLogQuery,
  AuditLogQueryBaseSchema,
  AuditLogQuerySchema,
  AuditLogSchema,
  type AuditModule,
  type AuditResult,
  type AuditSeverity,
  MODULE_EVENT_TYPES,
} from "./audit.js"

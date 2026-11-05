/**
 * 审计日志常量
 * 集中管理 module / eventType / result 字面量，避免散布字符串
 *
 * 用途：Service 层声明审计元数据 + writeLog 调用时使用；
 *      前端展示筛选下拉时也可复用（通过 *_LABELS 映射渲染中文）。
 *
 * 项目按需扩展：新增业务模块时在 AUDIT_MODULES 补一条 + LABELS 补中文即可。
 */

// ─── 审计模块（对应业务域，示例仅留 USER / SYSTEM 两条） ─────────────────────
export const AUDIT_MODULES = {
  USER: "user",
  SYSTEM: "system",
} as const

export type AuditModule = (typeof AUDIT_MODULES)[keyof typeof AUDIT_MODULES]

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  user: "用户管理",
  system: "系统管理",
}

// ─── 审计事件类型 ─────────────────────────────────────────────────────────────
// CRUD 类：由 Service 层声明式包装器（audited-crud）自动写入
// 例外类（登录、密码等）：保留在 handler 内手动写入
export const AUDIT_EVENT_TYPES = {
  // ── CRUD 类 ──
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",

  // ── 例外类（登录、密码相关） ──
  LOGIN: "login",
  LOGOUT: "logout",
  CHANGE_PWD: "change_pwd",
} as const

export type AuditEventType =
  (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES]

export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  create: "新增",
  update: "编辑",
  delete: "删除",
  login: "登录",
  logout: "登出",
  change_pwd: "修改密码",
}

// ─── 审计结果 ─────────────────────────────────────────────────────────────────
export const AUDIT_RESULT = { SUCCESS: "success", FAILURE: "failure" } as const

export type AuditResult = (typeof AUDIT_RESULT)[keyof typeof AUDIT_RESULT]

export const AUDIT_RESULT_LABELS: Record<AuditResult, string> = {
  success: "成功",
  failure: "失败",
}

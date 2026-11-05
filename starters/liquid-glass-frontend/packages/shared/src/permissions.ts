/**
 * 权限注册表
 * 权限码唯一事实源 — 项目按需填充
 *
 * 设计约定：
 * - 权限码统一 `resource:action` 命名，接口/中间件只认权限码
 * - ROLE_PERMISSIONS 为角色 → 权限码的静态映射（admin 持有全量权限）
 * - 前端权限树（角色/账号配置界面）由 buildPermissionTree() 派生
 *
 * CRM 完整版差异点（在此扩展）：
 * - roles 表动态授权（DB 存 menus 权限码集合，多岗位并集）
 * - track 双轨模型 / adminOnly 不可授予集等按业务补充
 */

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/** 权限元数据定义 */
export interface PermissionDef {
  /** 权限码，resource:action 命名 */
  code: string
  /** 中文标签（权限树展示） */
  label: string
  /** 分组 key（权限树分组） */
  group: string
  /** 分组中文标签 */
  groupLabel: string
  /** menu=页面/菜单可见性；action=按钮/操作能力 */
  kind: "menu" | "action"
}

/** 权限码常量映射（业务代码统一经此引用，禁止散落字符串字面量） */
export const PERMISSIONS = {
  // [gen:module:permissions] 由 bun run gen:module 追加业务模块权限码（勿手改本行）
  USER_VIEW: "user:view",
  USER_EDIT: "user:edit",
  AUDIT_VIEW: "audit:view",
} as const

/** 权限常量键联合类型（保留 starter 原有导出名） */
export type Permission = keyof typeof PERMISSIONS

/** 权限码联合类型 — 路由中间件参数收紧用，拼写错误编译期暴露 */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ─── 注册表 ───────────────────────────────────────────────────────────────────

/** 全量权限注册表：权限树、admin 全量集均由此派生（示例仅留 user 两条） */
export const PERMISSION_REGISTRY: PermissionDef[] = [
  // [gen:module:permission-registry] 由 bun run gen:module 追加业务模块权限注册（勿手改本行）
  {
    code: PERMISSIONS.USER_VIEW,
    label: "用户列表",
    group: "user",
    groupLabel: "用户管理",
    kind: "menu",
  },
  {
    code: PERMISSIONS.USER_EDIT,
    label: "编辑用户",
    group: "user",
    groupLabel: "用户管理",
    kind: "action",
  },
  {
    code: PERMISSIONS.AUDIT_VIEW,
    label: "查看审计日志",
    group: "audit",
    groupLabel: "审计日志",
    kind: "menu",
  },
]

// ─── 派生集合 ─────────────────────────────────────────────────────────────────

/** 全量权限码 — admin 直接持有，自动从注册表收集，新增权限无需手动维护 */
export const ALL_PERMISSIONS: string[] = PERMISSION_REGISTRY.map((p) => p.code)

/**
 * 默认角色 — DB role 为 NULL（未配置）时按此角色处理
 *
 * JWT 签发兜底（modules/auth/auth.service.ts）与 permissionsForRole 共用同一
 * 常量，保证「token 里的角色」与「响应里的 permissions」永远一致，避免出现
 * 前端无权限、后端按 user 放行的分裂。
 */
export const DEFAULT_ROLE = "user"

/**
 * 角色 → 权限码静态映射（保留 starter 原有导出名）
 * admin 持有全量权限；其余角色按需登记
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
  [DEFAULT_ROLE]: [PERMISSIONS.USER_VIEW, PERMISSIONS.USER_EDIT],
}

/**
 * 角色 → 扁平权限码（后端 wire 序列化 / 鉴权共用）
 *
 * 权限来源的唯一收口：后端登录与 GET/PUT /users/me 用它把 `role` 解析成
 * `permissions: string[]` 下发；**前端只消费该数组，禁止自行按角色推导**，
 * 未来权限来源从静态 ROLE_PERMISSIONS 切换为 DB 动态授权时，前端零改动。
 *
 * 边界：
 * - `null` / `undefined`（DB role 未配置）按 DEFAULT_ROLE 处理，与 JWT 签发兜底一致；
 * - 未知角色 / 空串 → 空数组（fail-closed）；
 * - Object.hasOwn 判定，避免 `toString` / `__proto__` 等原型键被误当成角色；
 * - 返回副本，防止调用方修改污染 ROLE_PERMISSIONS 注册表。
 */
export function permissionsForRole(role: string | null | undefined): string[] {
  const effectiveRole = role ?? DEFAULT_ROLE
  if (!Object.hasOwn(ROLE_PERMISSIONS, effectiveRole)) return []
  return [...ROLE_PERMISSIONS[effectiveRole]]
}

// ─── 权限树派生 ───────────────────────────────────────────────────────────────

/** 权限树分组节点（前端角色/账号权限配置渲染用） */
export interface PermissionTreeGroup {
  key: string
  label: string
  children: { key: string; label: string; kind: "menu" | "action" }[]
}

/** 从注册表派生权限配置树：按注册表声明顺序分组聚合 */
export function buildPermissionTree(): PermissionTreeGroup[] {
  const groups: PermissionTreeGroup[] = []
  const byKey = new Map<string, PermissionTreeGroup>()
  for (const def of PERMISSION_REGISTRY) {
    let group = byKey.get(def.group)
    if (!group) {
      group = { key: def.group, label: def.groupLabel, children: [] }
      byKey.set(def.group, group)
      groups.push(group)
    }
    group.children.push({ key: def.code, label: def.label, kind: def.kind })
  }
  return groups
}

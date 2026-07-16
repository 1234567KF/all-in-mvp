/**
 * 权限编码骨架 — 项目按需填充
 * 示例:
 *   export const PERMISSIONS = {
 *     USER_CREATE: "user:create",
 *     USER_DELETE: "user:delete",
 *   } as const
 */
export const PERMISSIONS = {} as const
export type Permission = keyof typeof PERMISSIONS

/** 角色→权限映射骨架 — 项目按需填充 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {}

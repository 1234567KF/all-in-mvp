/**
 * flat-config 集成测试：web 端禁止 import「角色 → 权限」映射（eslint.config.js）
 *
 * 与 route-db-guard.test.js 同思路：加载真实 eslint.config.js，用 Linter.verify
 * 验证 web 配置块只拦截值导入（ROLE_PERMISSIONS / ALL_PERMISSIONS / permissionsForRole），
 * 放行契约类型、PERMISSIONS 常量与权限树派生等合法导入，且 API 端不受影响。
 * 盲区：namespace import（import * as shared）无法用 importNames 拦截，靠评审兜底。
 */
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { Linter } from "eslint"

import config from "../eslint.config.js"

// 绝对路径：eslint/match 与 cwd 无关，从任意目录跑 bun test 都能命中 web 配置块。
const ROOT = join(import.meta.dir, "..")
const WEB_FILE = join(ROOT, "apps/web/src/lib/__permission_import_guard.ts")
const WEB_PAGE_FILE = join(
  ROOT,
  "apps/web/src/pages/__permission_import_guard.tsx"
)
const API_FILE = join(ROOT, "apps/api/src/modules/user/user.service.ts")
const RESTRICTED_RULE_IDS = new Set(["no-restricted-imports"])

const linter = new Linter()

/** 只取权限导入禁令的报错，忽略未使用变量等无关 lint 噪音 */
function lintRestrictions(code, filename = WEB_FILE) {
  return linter
    .verify(code, config, { filename })
    .filter((message) => RESTRICTED_RULE_IDS.has(message.ruleId))
    .map((message) => message.ruleId)
}

describe("web 端禁止 import 角色→权限映射（eslint.config.js）", () => {
  it("三个映射导出在 web 均被拦截", () => {
    for (const name of [
      "ROLE_PERMISSIONS",
      "ALL_PERMISSIONS",
      "permissionsForRole",
    ]) {
      const code = `import { ${name} } from "shared"\nexport const x = ${name}\n`
      expect({ name, rules: lintRestrictions(code) }).toEqual({
        name,
        rules: ["no-restricted-imports"],
      })
    }
  })

  it("页面 tsx 同样拦截", () => {
    const code =
      'import { ROLE_PERMISSIONS } from "shared"\nexport const x = ROLE_PERMISSIONS\n'
    expect(lintRestrictions(code, WEB_PAGE_FILE)).toEqual([
      "no-restricted-imports",
    ])
  })

  it("re-export 同样拦截", () => {
    expect(
      lintRestrictions('export { ROLE_PERMISSIONS } from "shared"\n')
    ).toEqual(["no-restricted-imports"])
  })

  it("合法的 shared 导入不误报（契约类型 / PERMISSIONS / 权限树派生）", () => {
    const code = [
      'import { PERMISSIONS, buildPermissionTree } from "shared"',
      'import type { PermissionCode, User } from "shared"',
      "export const code: PermissionCode = PERMISSIONS.USER_VIEW",
      "export const tree = buildPermissionTree",
      "export type U = User",
    ].join("\n")

    expect(lintRestrictions(code)).toEqual([])
  })

  it("只约束 web：api 侧允许 import 映射", () => {
    const code =
      'import { ROLE_PERMISSIONS } from "shared"\nexport const x = ROLE_PERMISSIONS\n'
    expect(lintRestrictions(code, API_FILE)).toEqual([])
  })
})

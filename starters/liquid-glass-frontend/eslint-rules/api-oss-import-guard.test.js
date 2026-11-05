/**
 * flat-config 集成测试：业务模块禁止直连 ali-oss（eslint.config.js）
 *
 * 与 RuleTester 单测不同，这里加载真实 eslint.config.js，用 Linter.verify 验证
 * 「配置块 + 内置规则 + selector」组合行为：静态 import / re-export / 动态 import()
 * 是否都能拦住，shared/oss.ts 封装与模块测试是否放行。
 *
 * 约定见 AGENTS.md「对象存储与 SQLite 运维工具箱」：上传/下载统一走 shared/oss.ts，
 * 业务模块不得绕开双模封装直连 SDK。
 */
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { Linter } from "eslint"

import config from "../eslint.config.js"

const ROOT = join(import.meta.dir, "..")
const SERVICE_FILE = join(ROOT, "apps/api/src/modules/user/user.service.ts")
const ROUTE_FILE = join(ROOT, "apps/api/src/modules/user/user.route.ts")
const MODULE_TEST_FILE = join(
  ROOT,
  "apps/api/src/modules/user/user.route.test.ts"
)
// 双模封装的唯一合法 ali-oss 入口
const SHARED_OSS_FILE = join(ROOT, "apps/api/src/shared/oss.ts")

const IMPORT_RESTRICTION_RULE_IDS = new Set([
  "no-restricted-imports",
  "no-restricted-syntax",
])

const linter = new Linter()

/** 只取导入禁令相关规则的报错，忽略未使用变量等无关 lint 噪音。 */
function lintImportRestrictions(code, filename) {
  return linter
    .verify(code, config, { filename })
    .filter((message) => IMPORT_RESTRICTION_RULE_IDS.has(message.ruleId))
    .map((message) => message.ruleId)
}

describe("业务模块禁止直连 ali-oss（eslint.config.js）", () => {
  it("service / route 静态 import 与 re-export 全部拦截", () => {
    const cases = [
      'import OSS from "ali-oss"',
      'import { STS } from "ali-oss"',
      'export { STS } from "ali-oss"',
    ]

    for (const filename of [SERVICE_FILE, ROUTE_FILE]) {
      for (const line of cases) {
        expect({
          filename,
          line,
          rules: lintImportRestrictions(
            `${line}\nexport const x = 1\n`,
            filename
          ),
        }).toEqual({
          filename,
          line,
          rules: ["no-restricted-imports"],
        })
      }
    }
  })

  it("service / route 动态 import() 同样拦截", () => {
    const code = 'export async function load() { return import("ali-oss") }\n'

    for (const filename of [SERVICE_FILE, ROUTE_FILE]) {
      expect({
        filename,
        rules: lintImportRestrictions(code, filename),
      }).toEqual({ filename, rules: ["no-restricted-syntax"] })
    }
  })

  it("shared/oss.ts 是唯一合法入口，不误报", () => {
    expect(
      lintImportRestrictions(
        'import OSS from "ali-oss"\nexport const x = OSS\n',
        SHARED_OSS_FILE
      )
    ).toEqual([])
  })

  it("模块测试文件放行（测试可能需要 mock SDK）", () => {
    expect(
      lintImportRestrictions(
        'import OSS from "ali-oss"\nexport const x = OSS\n',
        MODULE_TEST_FILE
      )
    ).toEqual([])
  })

  it("合法依赖不误报（shared / 同模块 service / env）", () => {
    const code = [
      'import { env } from "../../env.js"',
      'import { ServiceError } from "../../shared/service-error.js"',
      'import { listUsers } from "./user.service.js"',
      "export const x = [env, ServiceError, listUsers]",
    ].join("\n")

    expect(lintImportRestrictions(code, SERVICE_FILE)).toEqual([])
  })
})

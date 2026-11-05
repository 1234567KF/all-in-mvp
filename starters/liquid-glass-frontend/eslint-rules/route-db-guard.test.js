/**
 * flat-config 集成测试：route 层禁止直连数据库（eslint.config.js）
 *
 * 与同目录其它 RuleTester 单测不同，这里加载真实的 eslint.config.js，用 Linter.verify
 * 验证「配置块 + 内置规则 + selector」的组合行为：静态 import / re-export / 动态
 * import() 是否都能拦住，service / env / shared 等合法导入是否放行。
 *
 * 背景：no-restricted-imports 只遍历静态 ImportDeclaration 与 re-export（不含
 * ImportExpression），所以动态 import() 由同一个 route 块里的 no-restricted-syntax
 * 选择器兜底；require() 则由 @typescript-eslint/no-require-imports 全仓拦截。
 */
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { Linter } from "eslint"

import config from "../eslint.config.js"

// 绝对路径：eslint/match 与 cwd 无关，从任意目录跑 bun test 都能命中 route 配置块。
const ROOT = join(import.meta.dir, "..")
const ROUTE_FILE = join(ROOT, "apps/api/src/modules/__route_db_guard.route.ts")
const SERVICE_FILE = join(ROOT, "apps/api/src/modules/user/user.service.ts")
const DB_RESTRICTION_RULE_IDS = new Set([
  "no-restricted-imports",
  "no-restricted-syntax",
])

const linter = new Linter()

/** 只取 route DB 禁令相关规则的报错，忽略未使用变量等无关 lint 噪音。 */
function lintDbRestrictions(code, filename = ROUTE_FILE) {
  return linter
    .verify(code, config, { filename })
    .filter((message) => DB_RESTRICTION_RULE_IDS.has(message.ruleId))
    .map((message) => message.ruleId)
}

describe("route 层禁止直连数据库（eslint.config.js）", () => {
  it("静态 import db / drizzle / bun:sqlite 全部拦截", () => {
    const cases = [
      'import { getDrizzle } from "../../db.js"',
      'import { resetDemoNotifications } from "../../db/demo-seed.js"',
      'import { eq } from "drizzle-orm"',
      'import { sqliteTable } from "drizzle-orm/sqlite-core"',
      'import { Database } from "bun:sqlite"',
    ]

    for (const line of cases) {
      expect({
        line,
        rules: lintDbRestrictions(`${line}\nexport const x = 1\n`),
      }).toEqual({ line, rules: ["no-restricted-imports"] })
    }
  })

  it("re-export 与 import type 同样拦截", () => {
    expect(
      lintDbRestrictions('export { getDrizzle } from "../../db.js"\n')
    ).toEqual(["no-restricted-imports"])
    expect(
      lintDbRestrictions(
        'import type { DrizzleDB } from "../../db.js"\nexport type X = DrizzleDB\n'
      )
    ).toEqual(["no-restricted-imports"])
  })

  it("动态 import() 由 no-restricted-syntax 拦截", () => {
    const cases = [
      'export async function f() { return import("../../db.js") }',
      'export async function f() { return import("../../db/demo-seed.js") }',
      'export async function f() { return import("drizzle-orm/sqlite-core") }',
      'export async function f() { return import("bun:sqlite") }',
    ]

    for (const code of cases) {
      expect({ code, rules: lintDbRestrictions(code) }).toEqual({
        code,
        rules: ["no-restricted-syntax"],
      })
    }
  })

  it("require() 由 no-require-imports 全仓拦截", () => {
    const messages = linter.verify(
      'const m = require("../../db.js")\nexport const x = m\n',
      config,
      { filename: ROUTE_FILE }
    )

    expect(messages.map((message) => message.ruleId)).toContain(
      "@typescript-eslint/no-require-imports"
    )
  })

  it("合法导入不误报（env / shared / service / 普通相对模块）", () => {
    const code = [
      'import { env } from "../../env.js"',
      'import { PERMISSIONS } from "shared"',
      'import { listNotifications } from "./notification.service.js"',
      "export const x = [env, PERMISSIONS, listNotifications]",
    ].join("\n")

    expect(lintDbRestrictions(code)).toEqual([])
  })

  it("只约束 route 层：service 文件允许 import db", () => {
    expect(
      lintDbRestrictions(
        'import { getDrizzle } from "../../db.js"\nexport const x = getDrizzle\n',
        SERVICE_FILE
      )
    ).toEqual([])
  })
})

import { describe, it } from "bun:test"
import { RuleTester } from "eslint"
import { parser as tsParser } from "typescript-eslint"

import rule from "./no-audit-fn-without-opctx.js"

RuleTester.describe = (text, method) => describe(text, method)
RuleTester.it = (text, method) => it(text, method)
RuleTester.itOnly = (text, method) => it.only(text, method)

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

ruleTester.run("no-audit-fn-without-opctx", rule, {
  valid: [
    {
      name: "只读 service 不需要 OpCtx",
      code: "export function getMe(email: string) { return db.find(email) }",
    },
    {
      name: "非导出审计 helper 不强制修改签名",
      code: "function writeAudit(input: Input) { audit(input, {}) }",
    },
    {
      name: "直接调用 auditor 且首参为 OpCtx",
      code: "export function login(ctx: OpCtx, input: LoginInput) { audit({ ...ctx }, input) }",
    },
    {
      name: "声明式 CRUD 且首参为 OpCtx",
      code: "export const updateMe = (ctx: OpCtx, patch: Patch) => { auditedUpdate({ ctx, data: patch }) }",
    },
  ],
  invalid: [
    {
      name: "直接写审计但没有参数",
      code: "export function logIn() { audit({}, {}) }",
      errors: [{ messageId: "noParams" }],
    },
    {
      name: "直接写审计但首参不是 OpCtx",
      code: "export function createUser(input: UserInput) { auditedInsert({ row: input }) }",
      errors: [{ messageId: "missingOpCtx" }],
    },
    {
      name: "OpCtx 不在首参",
      code: "export default function deleteUser(id: string, ctx: OpCtx) { auditedDelete({ ctx }) }",
      errors: [{ messageId: "missingOpCtx" }],
    },
    {
      name: "上下文别名不能替代明确的 OpCtx 契约",
      code: "export const remove = (ctx: AuditContext) => { auditedDelete({ ctx }) }",
      errors: [{ messageId: "missingOpCtx" }],
    },
  ],
})

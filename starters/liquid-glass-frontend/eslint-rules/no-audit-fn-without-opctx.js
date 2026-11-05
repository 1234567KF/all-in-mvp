/**
 * Custom ESLint Rule: no-audit-fn-without-opctx
 *
 * Requires the first parameter of an *exported* service function that writes an
 * audit record to be annotated `OpCtx`.
 *
 * Rationale: OpCtx (operatorId / operator / operatorAccount / operatorRole /
 * ipAddress / userAgent / requestId) is the single carrier of audit identity.
 * A function that writes audit records but does not receive OpCtx must
 * re-assemble those fields by hand, which drifts (missing requestId, wrong
 * operatorRole) and duplicates the mapping that `createAuditor` already
 * eliminates. Requiring OpCtx as the first parameter keeps the service
 * signature self-documenting about its audit obligation.
 *
 * Scope is deliberately narrow — only functions that actually call an auditor:
 *   - Read-only queries (e.g. `getMe(email)`) write no audit and must NOT be
 *     forced to accept OpCtx.
 *   - Unauthenticated entries (login / register / password reset) DO have an
 *     OpCtx: mount `opCtxMiddleware` alone (without authMiddleware) to obtain a
 *     hollow ctx carrying ip/ua/requestId, then override the operator fields.
 *     There is no "no OpCtx available, so hand-roll writeLog" case.
 *
 * Always spread the whole ctx (`audit({ ...ctx, operator, ... }, ...)`) rather
 * than assembling ip/ua/requestId field by field. A field-by-field params object
 * gives the caller a slot to pass an empty value — that is exactly how a real
 * project ended up hardcoding `requestId: ""` on its refresh path, leaving
 * token-reuse security events uncorrelatable with the request that raised them.
 *
 * Identity override is chosen by resolvability, not by endpoint type: use the
 * real resolved user when one exists (login success → DB lookup; token-based
 * flows → the user resolved from the token's `sub`), and fall back to the
 * claimed value only when nothing can be resolved (login failure, unknown
 * account, rate-limit lockout). A claimed value is an unverified assertion and
 * must not be used for attribution.
 *
 * Correct alternatives:
 *   - Authenticated write:  export function createX(ctx: OpCtx, input: CreateXInput)
 *   - Unauthenticated:      auth.use("*", opCtxMiddleware) in the route, then
 *                           export function login(ctx: OpCtx, input: LoginInput)
 *                           and audit({ ...ctx, operator: account }, { ... })
 *   - Read-only query:      leave as-is, no OpCtx needed (rule does not fire)
 *
 * Known blind spots (green lint does NOT prove these dimensions are clean —
 * they are review's job, not lint's):
 *   - Indirect audit writes: a function that calls a local helper which in turn
 *     calls the auditor is not flagged, since the audit call resolves to the
 *     helper's frame rather than the exported one.
 *   - Non-top-level function containers: `isExported` only walks
 *     VariableDeclarator → VariableDeclaration, so object-literal methods
 *     (`export const svc = { create(ctx) {} }`, parent is `Property`) and class
 *     methods (`export class`, parent is `MethodDefinition`) are treated as
 *     non-exported and skipped. Neither shape exists in `*.service.ts` today
 *     (`export class` is used only for domain error classes), but if services
 *     ever adopt them for business methods this rule fails silently.
 *
 * Deliberately NOT covered: `.route.ts`. A handler's ctx comes from
 * `c.get("opCtx")` — there is no first parameter to constrain, so applying the
 * rule there would either never fire or fire spuriously. Bare `writeLog` in a
 * route IS still caught, by the `no-restricted-syntax` block in eslint.config.js
 * (that block is scoped to every .ts file under modules/, routes included). The
 * correct route form `audit(c.get("opCtx"), ...)` must not be reported.
 */

const AUDIT_CALLEES = new Set([
  "audit",
  "auditedInsert",
  "auditedUpdate",
  "auditedDelete",
])

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
])

/** Is this function node reached through an `export` statement? */
function isExported(node) {
  let cur = node.parent
  // export const foo = () => {}  →  ArrowFunctionExpression ← VariableDeclarator ← VariableDeclaration ← ExportNamedDeclaration
  if (cur && cur.type === "VariableDeclarator") cur = cur.parent
  if (cur && cur.type === "VariableDeclaration") cur = cur.parent
  return Boolean(
    cur &&
      (cur.type === "ExportNamedDeclaration" ||
        cur.type === "ExportDefaultDeclaration")
  )
}

/** Does the first parameter carry an explicit `OpCtx` type annotation? */
function hasOpCtxFirstParam(node) {
  const first = node.params[0]
  if (!first) return false
  // 兼容 `ctx: OpCtx` 与带默认值/可选标记的形态
  const target =
    first.type === "AssignmentPattern" ? first.left : first
  const annotation = target.typeAnnotation?.typeAnnotation
  return (
    annotation?.type === "TSTypeReference" &&
    annotation.typeName?.type === "Identifier" &&
    annotation.typeName.name === "OpCtx"
  )
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require an OpCtx first parameter on exported service functions that write audit records.",
    },
    messages: {
      missingOpCtx:
        "This exported function writes audit records ({{callees}}) but its first parameter is not `OpCtx`. Audit identity must flow through OpCtx — see AGENTS.md「Service 约定」. Unauthenticated entries still have one: mount opCtxMiddleware alone and override operator via audit({ ...ctx, operator }).",
      noParams:
        "This exported function writes audit records ({{callees}}) but takes no parameters. Add `ctx: OpCtx` as the first parameter so audit identity flows through OpCtx.",
    },
    schema: [],
  },

  create(context) {
    // 函数栈：进入函数时压栈，遇到审计调用标记栈顶，退出时判定并弹栈。
    // 用栈而非手写遍历，天然处理嵌套函数——审计调用归属于最内层函数。
    const stack = []

    function enter(node) {
      stack.push({ node, callees: new Set() })
    }

    function exit(node) {
      const frame = stack.pop()
      if (!frame || frame.node !== node) return
      if (frame.callees.size === 0) return
      if (!isExported(node)) return
      if (hasOpCtxFirstParam(node)) return

      const callees = [...frame.callees].join(", ")
      context.report({
        node: node.params[0] ?? node,
        messageId: node.params.length === 0 ? "noParams" : "missingOpCtx",
        data: { callees },
      })
    }

    const visitors = {}
    for (const type of FUNCTION_TYPES) {
      visitors[type] = enter
      visitors[`${type}:exit`] = exit
    }

    visitors.CallExpression = (node) => {
      if (node.callee.type !== "Identifier") return
      if (!AUDIT_CALLEES.has(node.callee.name)) return
      // 标记最内层 enclosing function；栈空说明调用在模块顶层，不属任何导出函数
      const frame = stack[stack.length - 1]
      if (frame) frame.callees.add(node.callee.name)
    }

    return visitors
  },
}

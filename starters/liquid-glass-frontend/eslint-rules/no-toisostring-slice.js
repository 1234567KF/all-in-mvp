/**
 * Custom ESLint Rule: no-toisostring-slice
 *
 * Disallows calling .slice(), .substring(), .substr(), or .split()
 * on the result of .toISOString().
 *
 * Rationale: toISOString() returns a UTC timestamp. Truncating it to
 * extract a date portion (e.g. "2026-07-10T16:00:00.000Z" → "2026-07-10")
 * shifts the date backward in UTC+ timezones (UTC+8 midnight → previous
 * day 16:00 UTC). This is a recurring source of date bugs.
 *
 * Correct alternatives:
 *   - For display:          formatDate(new Date())       // @/lib/date-utils
 *   - For query parameters: new Date().toISOString()      // full ISO, no truncation
 *   - For end-of-day range: getLocalDayBoundaryISO(new Date(), "end")  // @/lib/date-utils
 *
 * Scope note: formatDate / getLocalDayBoundaryISO live in apps/web, and the "@/"
 * alias resolves only there (apps/api defines no path alias). In apps/api, pass
 * the full ISO timestamp or add the helper to packages/shared.
 *
 * Known blind spots（lint 绿不代表没有同类日期 bug）:
 *   - 跨语句拆分：`const iso = d.toISOString(); iso.slice(0, 10)` 是同一种错，
 *     但 slice 的接收者已不是 toISOString() 调用，AST 上拦不到。
 *   - 其它 UTC 来源：`Date.UTC(...)`、`toISOString().slice` 之外的
 *     手搓日期拼接（如 `${y}-${m}-${d}` 用 getUTCXxx）不在本规则范围。
 *   这两类由 code-review 与 date-utils 的时区不变量测试兜底。
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow toISOString().slice/substring/split — truncating UTC ISO strings causes timezone shift bugs in UTC+ timezones.',
    },
    messages: {
      avoidTruncation:
        'Avoid toISOString().{{method}} — truncating a UTC ISO string shifts dates backward in UTC+ timezones. Use formatDate(new Date()) for local date strings, or pass full ISO timestamps for query parameters.',
    },
    schema: [],
  },
  create(context) {
    const dangerousMethods = new Set(['slice', 'substring', 'substr', 'split'])

    /** Unwrap ChainExpression (optional chaining wrapper) to get the inner node. */
    function unwrapChain(node) {
      if (node && node.type === 'ChainExpression') return node.expression
      return node
    }

    /** Check if a node is an Identifier with the given name. */
    function isIdentifierNamed(node, name) {
      return node && node.type === 'Identifier' && node.name === name
    }

    return {
      // Catches: x.toISOString().slice(...) / .substring(...) / .split(...)
      CallExpression(node) {
        // The outer call is .slice()/.substring()/.substr()/.split()
        if (!node.callee || node.callee.type !== 'MemberExpression') return

        const methodProp = node.callee.property
        if (!methodProp || methodProp.type !== 'Identifier') return
        if (!dangerousMethods.has(methodProp.name)) return

        // The object the method is called on — unwrap optional chaining
        const obj = unwrapChain(node.callee.object)

        // Check if it's a toISOString() call
        if (!obj || obj.type !== 'CallExpression') return
        if (!obj.callee || obj.callee.type !== 'MemberExpression') return

        const toIsoProp = obj.callee.property
        if (!isIdentifierNamed(toIsoProp, 'toISOString')) return

        context.report({
          node,
          messageId: 'avoidTruncation',
          data: { method: methodProp.name },
        })
      },
    }
  },
}

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
 *   - For end-of-day range: construct local 23:59:59 then .toISOString()
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

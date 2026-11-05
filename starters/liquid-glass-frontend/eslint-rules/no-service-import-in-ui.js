/**
 * Custom ESLint Rule: no-service-import-in-ui
 *
 * Disallows runtime (value) imports from the services layer inside UI layers
 * (pages/ and components/). Type-only imports are allowed.
 *
 * Detects both alias imports ("@/services/foo") and relative imports
 * ("../../services/foo") that resolve into src/services/.
 *
 * Rationale: server state must flow through TanStack Query hooks
 * (hooks/queries/*) so that caching, invalidation and error handling stay
 * centralized. Components calling services directly bypass the cache and
 * re-introduce ad-hoc fetch effects.
 *
 * Correct alternatives:
 *   - lists/details: useCustomers(), useOpportunities(), useChannels(), …
 *   - mutations:     useCreateXxx()/useUpdateXxx() with mutateAsync
 *   - types only:    import type { Foo } from "@/services/foo"  (allowed)
 *
 * Known blind spots（lint 绿不代表服务层隔离已满足）:
 *   - 只访问 ImportDeclaration：`export { x } from "@/services/x"` 这类
 *     re-export 转承，以及 `await import("@/services/x")` 动态导入都不产生
 *     ImportDeclaration，因此拦不到。
 *   - 别名只认 `@/services/`（带尾斜杠）：`import s from "@/services"` 直接
 *     指向 barrel 目录不匹配前缀；其它别名（`~/services`）同理。
 *   - `require("@/services/x")` 形式不拦（本仓 ESM，实际风险低）。
 *   - 作用域由 eslint.config.js 决定，只覆盖 pages/**.tsx 与 components/**.tsx；
 *     写在 `hooks/` 里的取值逻辑不在本规则范围内——那层本就该被 Query hooks 包住。
 */
import path from 'node:path'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow value imports from the services layer in pages/components — server state must go through hooks/queries (TanStack Query).',
    },
    messages: {
      noServiceImport:
        'Do not import "{{source}}" directly in UI layer. Server state must go through TanStack Query hooks (hooks/queries/*). Type-only imports are allowed.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()

    function isServiceImport(source) {
      // Alias form: @/services/...
      if (source.startsWith('@/services/')) return true
      // Relative form: resolve against current file and check if it lands in src/services/
      if (source.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filename), source)
        // Normalize separators for Windows compatibility
        const normalized = resolved.replace(/\\/g, '/')
        return /\/src\/services\//.test(normalized)
      }
      return false
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string' || !isServiceImport(source)) {
          return
        }
        // import type { X } from "@/services/x" — allowed
        if (node.importKind === 'type') return
        // import { type A, type B } from … with only type specifiers — allowed
        const hasValueSpecifier = node.specifiers.some(
          (s) => s.importKind !== 'type',
        )
        if (!hasValueSpecifier) return

        context.report({
          node,
          messageId: 'noServiceImport',
          data: { source },
        })
      },
    }
  },
}

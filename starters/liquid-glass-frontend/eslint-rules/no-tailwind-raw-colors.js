/**
 * Custom ESLint Rule: no-tailwind-raw-colors
 *
 * Disallows raw Tailwind palette color utilities (e.g. text-red-500,
 * bg-green-600, border-blue-400) in className attributes.
 *
 * Rationale: the design system defines semantic tokens (--lg-danger,
 * --lg-warning, --data-success, tag-* classes, destructive variant).
 * Hard-coded palette colors bypass theming (dark mode, brand adjustments)
 * and drift from the design language.
 *
 * Correct alternatives（只列本脚手架真实存在的 token）:
 *   - text-red-500        → text-destructive / var(--lg-danger)
 *   - bg-red-500          → bg-destructive
 *   - 状态徽章            → badge-active / badge-inactive（design-utils.css）
 *   - 彩色标签            → tag-red / tag-green / tag-blue / tag-purple
 *   - 正向/成功文本       → text-[var(--data-success)]
 *   - warning 提示块      → color-mix(...) with var(--lg-warning)
 *
 * Known blind spots（lint 绿不代表主题化已完成，这些形态拦不到）:
 *   - 颜色来自变量/常量：`const c = "text-red-500"` 后 `className={c}`，
 *     或 colors 定义在 className 之外的对象/映射表里。
 *   - 任意值写法：`text-[#ff0000]` / `bg-[rgb(255,0,0)]` 不含调色板名，
 *     正则拦不到；硬编码 hex 由 DESIGN.md 与 code-review 负责。
 *   - 非 className 属性（style={{ color: "red" }}、SVG fill="red"）。
 *   - 字符串拼接后注入 class（`"text-" + tone + "-500"`）。
 *   - 作用域边界：仅在 eslint.config.js 的 apps/web pages/**.tsx 与 components/**.tsx
 *     启为 error；写在 `*.ts`（如 class 常量表）、`lib/`、`layouts/` 里的原色类不拦。
 */

// text-red-500, bg-green-600/10, border-l-red-500, ring-offset-blue-500, divide-y-blue-200 …
const RAW_COLOR_RE =
  /\b(?:text|bg|border|ring|fill|stroke|outline|decoration|divide|shadow|accent|caret|from|via|to)(?:-[trblsexy])?(?:-offset)?(?:-\d+)?-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}(?:\/\d{1,3})?\b/

// matchAll 需要 g 旗标；matchAll 内部会克隆正则，共享实例不会污染 lastIndex。
const RAW_COLOR_RE_G = new RegExp(RAW_COLOR_RE.source, 'g')

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw Tailwind palette colors (text-red-500 etc.) in className — use semantic design tokens instead.',
    },
    messages: {
      rawColor:
        'Raw Tailwind palette color "{{match}}" bypasses the design system. Use semantic tokens instead (text-destructive, var(--lg-danger), var(--data-success), badge-active/badge-inactive, tag-red/green/blue/purple, …).',
    },
    schema: [],
  },
  create(context) {
    function checkString(node, value) {
      // matchAll 而非单次 exec：一条 className 里常同时出现多个原色类
      // （如 "divide-y-blue-200 ring-offset-blue-500"），只报第一处会让修完一处
      // 后 lint 依然红，属于"漏报一次"的静默失败族 —— 全量上报。
      const matches = [...value.matchAll(RAW_COLOR_RE_G)]
      for (const match of matches) {
        context.report({
          node,
          messageId: 'rawColor',
          data: { match: match[0] },
        })
      }
    }

    return {
      JSXAttribute(node) {
        if (
          !node.name ||
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'className'
        ) {
          return
        }
        const value = node.value
        if (!value) return

        // className="text-red-500"
        if (value.type === 'Literal' && typeof value.value === 'string') {
          checkString(value, value.value)
          return
        }

        // className={...} — inspect string literals & template chunks inside
        if (value.type === 'JSXExpressionContainer') {
          const sourceCode = context.sourceCode ?? context.getSourceCode()
          const visit = (expr) => {
            if (!expr || typeof expr !== 'object') return
            if (expr.type === 'Literal' && typeof expr.value === 'string') {
              checkString(expr, expr.value)
              return
            }
            if (expr.type === 'TemplateLiteral') {
              for (const quasi of expr.quasis) {
                checkString(quasi, quasi.value.raw)
              }
              for (const sub of expr.expressions) visit(sub)
              return
            }
            // Walk common composition shapes: cn(...), cond ? a : b, a && b
            for (const key of Object.keys(expr)) {
              if (key === 'parent') continue
              const child = expr[key]
              if (Array.isArray(child)) {
                for (const c of child) {
                  if (c && typeof c.type === 'string') visit(c)
                }
              } else if (child && typeof child.type === 'string') {
                visit(child)
              }
            }
          }
          void sourceCode
          visit(value.expression)
        }
      },
    }
  },
}

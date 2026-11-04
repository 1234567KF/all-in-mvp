/**
 * Custom ESLint Rule: no-raw-viewport-check
 *
 * Disallows direct `window.innerWidth` usage in UI code (pages/components).
 *
 * Rationale: viewport-width branching must go through the single source of
 * truth — `useIsMobile()` (@/hooks/use-mobile, md/768px) — or pure CSS
 * breakpoint classes. Ad-hoc `window.innerWidth` checks create inconsistent
 * breakpoints (640 vs 768 vs 1024), don't react to resize, and bypass the
 * responsive conventions in DESIGN.md.
 *
 * Correct alternatives:
 *   - Structural fork (table/cards, Dialog/Sheet): useIsMobile()
 *   - Style-only difference (show/hide, layout):   Tailwind breakpoint classes
 *   - Touch capability:                            pointer-coarse: / (pointer: coarse)
 *
 * Known blind spots（lint 绿不代表响应式规范已满足）:
 *   - 别名后的读取：`const w = window; w.innerWidth`、`globalThis.innerWidth`
 *     都要求 object 是标识符 `window`，因此拦不到。
 *   - 其它宽度来源：`document.documentElement.clientWidth`、
 *     `matchMedia("(max-width: 767px)")`、元素 `offsetWidth` 不在本规则范围。
 *   - 只治 innerWidth：innerHeight 相关的分叉不拦（本规则只针对断点混用这一个坑）。
 *   - 计算属性用模板字面量：`window[`innerWidth`]` 的 property 既非 Identifier
 *     也非 Literal，两条判断都不命中 → 拦不到。
 *   - 函数参数解构：`({ innerWidth }) => …` 只在 VariableDeclarator 上检测，
 *     参数位置的解构拦不到。
 *   - 作用域边界：eslint.config.js 只在 apps/web 的 pages/**.tsx 与 components/**.tsx
 *     启为 error，写在 `*.ts`、`lib/`、`hooks/`、`layouts/` 里的分叉不会被拦。
 *     （hooks/use-mobile.ts 直读 innerWidth 是单一真源本身，属预期。）
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow window.innerWidth in UI code — use useIsMobile() or CSS breakpoint classes instead.",
    },
    messages: {
      noRawViewport:
        "Do not read window.innerWidth directly. Use useIsMobile() (@/hooks/use-mobile) for structural forks, Tailwind breakpoint classes for style-only differences, or pointer-coarse for touch detection.",
    },
    schema: [],
  },
  create(context) {
    return {
      // Catches: window.innerWidth / window?.innerWidth / window["innerWidth"]
      MemberExpression(node) {
        if (
          node.object &&
          node.object.type === "Identifier" &&
          node.object.name === "window" &&
          node.property &&
          ((node.property.type === "Identifier" &&
            node.property.name === "innerWidth") ||
            (node.property.type === "Literal" &&
              node.property.value === "innerWidth"))
        ) {
          context.report({ node, messageId: "noRawViewport" })
        }
      },
      // Catches destructuring: const { innerWidth } = window
      VariableDeclarator(node) {
        if (
          node.init &&
          node.init.type === "Identifier" &&
          node.init.name === "window" &&
          node.id.type === "ObjectPattern"
        ) {
          for (const prop of node.id.properties) {
            if (
              prop.type === "Property" &&
              ((prop.key.type === "Identifier" &&
                prop.key.name === "innerWidth") ||
                (prop.key.type === "Literal" &&
                  prop.key.value === "innerWidth"))
            ) {
              context.report({ node: prop, messageId: "noRawViewport" })
            }
          }
        }
      },
    }
  },
}

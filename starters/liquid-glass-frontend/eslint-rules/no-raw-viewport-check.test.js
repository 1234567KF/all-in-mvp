import { describe, it } from "bun:test"
import { RuleTester } from "eslint"
import { parser as tsParser } from "typescript-eslint"

import rule from "./no-raw-viewport-check.js"

RuleTester.describe = (text, method) => describe(text, method)
RuleTester.it = (text, method) => it(text, method)
RuleTester.itOnly = (text, method) => it.only(text, method)

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

ruleTester.run("no-raw-viewport-check", rule, {
  valid: [
    {
      name: "结构分叉走 useIsMobile（单一真源，md/768px）",
      code: `import { useIsMobile } from "@/hooks/use-mobile"
            const mobile = useIsMobile()`,
    },
    {
      name: "innerHeight 不在本规则范围（只治断点分叉这一个坑）",
      code: "const h = window.innerHeight",
    },
    {
      name: "样式差异用 CSS 断点类",
      code: 'const cls = "hidden md:block"',
    },
  ],
  invalid: [
    {
      name: "直读 window.innerWidth 做窄屏分叉",
      code: "const mobile = window.innerWidth < 768",
      errors: [{ messageId: "noRawViewport" }],
    },
    {
      name: "640 与 768 断点混用正是这条规则要消除的",
      code: "if (window.innerWidth < 640) { setShowCard(true) }",
      errors: [{ messageId: "noRawViewport" }],
    },
    {
      name: "可选链形态",
      code: "const w = window?.innerWidth",
      errors: [{ messageId: "noRawViewport" }],
    },
    {
      name: "字符串下标形态 window[\"innerWidth\"]",
      code: "const w = window[\"innerWidth\"]",
      errors: [{ messageId: "noRawViewport" }],
    },
    {
      name: "解构形态 const { innerWidth } = window",
      code: "const { innerWidth } = window",
      errors: [{ messageId: "noRawViewport" }],
    },
    {
      name: "JSX 事件处理器里的直读也要拦",
      code: `const C = () => <div onMouseMove={(e) => {
                  const { innerWidth } = window
                  return <span>{e.clientX / innerWidth}</span>
                }}>x</div>`,
      errors: [{ messageId: "noRawViewport" }],
    },
  ],
})

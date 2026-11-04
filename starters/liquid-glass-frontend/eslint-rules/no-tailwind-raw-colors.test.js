import { describe, it } from "bun:test"
import { RuleTester } from "eslint"
import { parser as tsParser } from "typescript-eslint"

import rule from "./no-tailwind-raw-colors.js"

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

ruleTester.run("no-tailwind-raw-colors", rule, {
  valid: [
    {
      name: "语义 destructive 变体是本仓库的正解",
      code: 'const C = () => <span className="text-destructive">*</span>',
    },
    {
      name: "design-utils.css 里真实存在的徽章/标签类",
      code: 'const C = () => <span className="badge-active tag-red">x</span>',
    },
    {
      name: "主题变量任意值不命中调色板名",
      code: 'const C = () => <span className="text-[var(--data-success)]">x</span>',
    },
    {
      name: "断点/间距等非颜色工具类不拦",
      code: 'const C = () => <div className="hidden md:block px-4">x</div>',
    },
  ],
  invalid: [
    {
      name: "字面量 className 里的原色类",
      code: 'const C = () => <span className="text-red-500">x</span>',
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "cn() 组合的第一个参数同样要拦",
      code: 'const C = ({ v }) => <span className={cn("bg-green-600", v)}>x</span>',
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "条件表达式两支都要检查",
      code: 'const C = ({ up }) => <span className={up ? "text-emerald-500" : "text-rose-600"}>x</span>',
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }],
    },
    {
      name: "模板字符串的 quasis 不能漏",
      code: "const tone = 'blue'\nconst C = () => <span className={`border border-${tone}-200 text-blue-500`}>x</span>",
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "带透明度的写法 bg-red-500/10",
      code: 'const C = () => <div className="bg-red-500/10">x</div>',
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "border/ring/divide 等前缀族都要覆盖",
      code: 'const C = () => <div className="divide-y-blue-200 ring-offset-blue-500">x</div>',
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }],
    },
  ],
})

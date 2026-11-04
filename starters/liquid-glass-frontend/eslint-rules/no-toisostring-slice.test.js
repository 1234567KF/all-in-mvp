import { describe, it } from "bun:test"
import { RuleTester } from "eslint"
import { parser as tsParser } from "typescript-eslint"

import rule from "./no-toisostring-slice.js"

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

ruleTester.run("no-toisostring-slice", rule, {
  valid: [
    {
      name: "本地日期串走 formatDate（正解入口）",
      code: `import { formatDate } from "@/lib/date-utils"
            const today = formatDate(new Date())`,
    },
    {
      name: "完整 ISO 时间戳不做截断，是查询参数的正确形态",
      code: "const since = new Date().toISOString()",
    },
    {
      name: "slice 作用在普通字符串上不拦",
      code: "const prefix = fileName.slice(0, 3)",
    },
    {
      name: "先取本地日边界再转 ISO（范围查询正解）",
      code: `import { getLocalDayBoundaryISO } from "@/lib/date-utils"
            const to = getLocalDayBoundaryISO(new Date(), "end")`,
    },
  ],
  invalid: [
    {
      name: "UTC+ 时区把日期往前挪一天的典型写法",
      code: "const day = new Date().toISOString().slice(0, 10)",
      errors: [{ messageId: "avoidTruncation" }],
    },
    {
      name: "substring 同样截的是 UTC 日期",
      code: "const day = date.toISOString().substring(0, 10)",
      errors: [{ messageId: "avoidTruncation" }],
    },
    {
      name: "substr（遗留 API）也在拦截范围",
      code: "const day = date.toISOString().substr(0, 10)",
      errors: [{ messageId: "avoidTruncation" }],
    },
    {
      name: "split('T')[0] 是本项目的真实事故写法",
      code: "const day = new Date().toISOString().split('T')[0]",
      errors: [{ messageId: "avoidTruncation" }],
    },
    {
      name: "可选链写法不能绕过（ChainExpression 需先解包）",
      code: "const day = date?.toISOString()?.slice(0, 10)",
      errors: [{ messageId: "avoidTruncation" }],
    },
  ],
})

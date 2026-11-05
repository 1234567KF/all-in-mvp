import { describe, it } from "bun:test"
import { RuleTester } from "eslint"
import { parser as tsParser } from "typescript-eslint"

import rule from "./no-service-import-in-ui.js"

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

// 相对路径判定依赖文件名，必须显式给 filename 才能命中 /src/services/
const PAGE = "apps/web/src/pages/CustomersPage.tsx"

ruleTester.run("no-service-import-in-ui", rule, {
  valid: [
    {
      name: "type-only 导入允许（只做类型，不绕过缓存）",
      code: `import type { Customer } from "@/services/customers"`,
      filename: PAGE,
    },
    {
      name: "全部 specifier 都是 type 时允许",
      code: `import { type Customer, type ListResult } from "@/services/customers"`,
      filename: PAGE,
    },
    {
      name: "正解：走 hooks/queries 的 Query hook",
      code: `import { useCustomers } from "@/hooks/queries/useCustomers"`,
      filename: PAGE,
    },
    {
      name: "非 services 层的工具模块不拦",
      code: `import { formatDate } from "@/lib/format"`,
      filename: PAGE,
    },
    {
      name: "相对导入落在 services 之外不拦",
      code: `import { helper } from "../lib/format"`,
      filename: PAGE,
    },
    {
      name: "同名 ../services 但解析后落在 pages/services/ —— 不误报（解析用真实路径而非字符串前缀）",
      code: `import { helper } from "../services/localHelper"`,
      filename: "apps/web/src/pages/nested/CustomersPage.tsx",
    },
    // ── 以下三条是 Known blind spots：断言"当前确实拦不住"，
    //    规则若将来收紧，这三条会变红，届时按需把它们挪进 invalid。
    {
      name: "盲区：re-export 转承（export ... from）不在 ImportDeclaration 上",
      code: `export { listCustomers } from "@/services/customers"`,
      filename: PAGE,
    },
    {
      name: "盲区：动态 import() 不产生 ImportDeclaration",
      code: `const mod = await import("@/services/customers")`,
      filename: PAGE,
    },
    {
      name: "盲区：别名裸指向目录（'@/services' 无后续路径）不匹配前缀",
      code: `import services from "@/services"`,
      filename: PAGE,
    },
  ],
  invalid: [
    {
      name: "值导入 @/services/* —— 绕过 Query 缓存与错误处理",
      code: `import { listCustomers } from "@/services/customers"`,
      filename: PAGE,
      errors: [{ messageId: "noServiceImport" }],
    },
    {
      name: "相对路径解析到 src/services/ 同样要拦",
      code: `import { listCustomers } from "../../services/customers"`,
      filename: "apps/web/src/pages/nested/CustomersPage.tsx",
      errors: [{ messageId: "noServiceImport" }],
    },
    {
      name: "type 与值混写：只要有一个值 specifier 就报错",
      code: `import { type Customer, listCustomers } from "@/services/customers"`,
      filename: PAGE,
      errors: [{ messageId: "noServiceImport" }],
    },
    {
      name: "namespace 值导入（import * as）不属于 type specifier",
      code: `import * as customerApi from "@/services/customers"`,
      filename: PAGE,
      errors: [{ messageId: "noServiceImport" }],
    },
  ],
})

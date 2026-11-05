import js from "@eslint/js"
import globals from "globals"
import jsxA11y from "eslint-plugin-jsx-a11y"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

// 项目内置 ESLint 规则（若不需要可移除对应注册与启用）：
// - no-toisostring-slice：`.toISOString().slice(0, 10)` 在 UTC+ 时区会把日期往前挪一天
// - no-tailwind-raw-colors：禁止 Tailwind 原色类（text-red-500 等），必须走语义化 token
// - no-service-import-in-ui：pages/components 禁止值导入 @/services/*，服务端数据走 hooks/queries
// - no-raw-viewport-check：禁止直读 window.innerWidth，窄屏分叉须走 useIsMobile() 或 CSS 断点类
// - no-audit-fn-without-opctx：写审计的导出 service 函数首参必须是 OpCtx（后端架构约束）
import noAuditFnWithoutOpctx from "./eslint-rules/no-audit-fn-without-opctx.js"
import noRawViewportCheck from "./eslint-rules/no-raw-viewport-check.js"
import noServiceImportInUi from "./eslint-rules/no-service-import-in-ui.js"
import noTailwindRawColors from "./eslint-rules/no-tailwind-raw-colors.js"
import noToisostringSlice from "./eslint-rules/no-toisostring-slice.js"

// Downgrade all jsx-a11y rules from error to warn
const jsxA11yWarnRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(
    ([key, value]) => [
      key,
      Array.isArray(value) ? ["warn", ...value.slice(1)] : "warn",
    ]
  )
)

const HAS_PERMISSION_RESTRICTION = {
  selector: 'CallExpression[callee.name="hasPermission"]',
  message:
    "路由鉴权默认使用 requirePermission / requireRole / requireAdmin。资源级、字段级或依赖业务状态的授权请下沉到 service 领域方法；确需留在 handler 时，用 eslint-disable-next-line 附理由（见 AGENTS.md「权限体系」）。",
}

const WRITE_LOG_RESTRICTION = {
  selector: 'CallExpression[callee.name="writeLog"]',
  message:
    "禁止裸调 writeLog。CRUD 走 auditedInsert/Update/Delete，非 CRUD 走 createAuditor；未认证入口只挂 opCtxMiddleware 取空壳 OpCtx，再 audit({ ...ctx, operator: <登录目标账号> }) 覆盖（见 AGENTS.md「审计日志」）。",
}

export default defineConfig([
  // "**/dist" 而非 "dist"：flat config 的 ignore 模式相对配置文件所在目录解析，
  // 裸名只匹配根级 dist，apps/api/dist 与 packages/shared/dist 会漏网被当源码扫。
  globalIgnores(["**/dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: {
      "simple-import-sort": simpleImportSort,
      "project-rules": {
        rules: {
          "no-toisostring-slice": noToisostringSlice,
          "no-tailwind-raw-colors": noTailwindRawColors,
          "no-service-import-in-ui": noServiceImportInUi,
          "no-raw-viewport-check": noRawViewportCheck,
          "no-audit-fn-without-opctx": noAuditFnWithoutOpctx,
        },
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    // 提级为 error（默认 warn）：豁免修好后必须删掉 eslint-disable 指令。
    // 留着会让后人误以为此处仍受约束，也掩盖「违规已被真正修掉」的事实。
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "project-rules/no-toisostring-slice": "warn",
      ...jsxA11yWarnRules,
    },
  },
  // ─── UI 层架构约束（apps/web）────────────────────────────────────────────
  // 1) 禁止 Tailwind 原色类（text-red-500 等），必须走语义化 token
  // 2) 禁止组件内直接 value-import @/services/*（type-only 允许），服务端数据须走 hooks/queries
  // 3) 禁止直读 window.innerWidth，窄屏分叉须走 useIsMobile() 或 CSS 断点类
  {
    files: ["apps/web/src/pages/**/*.tsx", "apps/web/src/components/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "project-rules/no-tailwind-raw-colors": "error",
      "project-rules/no-service-import-in-ui": "error",
      "project-rules/no-raw-viewport-check": "error",
    },
  },
  // 永久豁免：一次性 auth 操作（login/changePassword）无缓存/失效语义，
  // 不适合强套 TanStack Query hooks；其余服务端数据一律走 hooks/queries/
  {
    files: [
      "apps/web/src/pages/LoginPage.tsx",
      "apps/web/src/pages/ProfileSettingsPage.tsx",
    ],
    rules: {
      "project-rules/no-service-import-in-ui": "off",
    },
  },
  // no-raw-viewport-check 存量豁免：错误页鼠标视差特效的坐标归一化（棘轮：清理后从此移除）
  {
    files: [
      "apps/web/src/pages/ForbiddenPage.tsx",
      "apps/web/src/pages/NotFoundPage.tsx",
      "apps/web/src/pages/ServerErrorPage.tsx",
    ],
    rules: {
      "project-rules/no-raw-viewport-check": "off",
    },
  },
  // ─── 后端架构约束（apps/api/src/modules）──────────────────────────────────
  // 1) modules 内禁裸调 writeLog：CRUD 走 auditedInsert/Update/Delete，非 CRUD
  //    走 createAuditor，避免手工拼装审计身份。
  // 2) hasPermission 只约束 route 的默认鉴权方式，不再禁止 service 表达资源级、
  //    字段级或依赖业务状态的授权。handler 中确有动态权限判断的例外，必须就地
  //    eslint-disable-next-line 并附理由。
  //
  // flat config 对同一 rule key 整体覆盖而非合并，因此使用互斥文件范围；两个块
  // 都配置 writeLog，避免 route 块覆盖 modules 块时丢失约束。
  //
  // 已知盲区：selector 只匹配直接具名调用，成员调用、别名导入等形态拦不到。
  // 这些规则用于拦截常见漂移，不能替代权限与审计链路的代码评审。
  {
    files: ["apps/api/src/modules/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.route.ts"],
    rules: {
      "no-restricted-syntax": ["error", WRITE_LOG_RESTRICTION],
    },
  },
  {
    files: ["apps/api/src/modules/**/*.route.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        HAS_PERMISSION_RESTRICTION,
        WRITE_LOG_RESTRICTION,
      ],
    },
  },
  // 3) 写审计的导出 service 函数首参必须标注 OpCtx。
  //    只检查直接 auditor 调用的签名，纯只读查询不受影响；间接审计与身份字段
  //    是否完整仍由类型设计和代码评审保证。
  //    与上面的 no-restricted-syntax 是不同 rule key，分块不会互相覆盖。
  {
    files: ["apps/api/src/modules/**/*.service.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "project-rules/no-audit-fn-without-opctx": "error",
    },
  },
])

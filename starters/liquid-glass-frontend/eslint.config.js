import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// 项目内置 ESLint 规则（若不需要可移除对应注册与启用）：
// - no-toisostring-slice：`.toISOString().slice(0, 10)` 在 UTC+ 时区会把日期往前挪一天
// - no-tailwind-raw-colors：禁止 Tailwind 原色类（text-red-500 等），必须走语义化 token
// - no-raw-viewport-check：禁止直读 window.innerWidth，窄屏分叉须走 useIsMobile() 或 CSS 断点类
import noRawViewportCheck from './eslint-rules/no-raw-viewport-check.js'
import noTailwindRawColors from './eslint-rules/no-tailwind-raw-colors.js'
import noToisostringSlice from './eslint-rules/no-toisostring-slice.js'

// Downgrade all jsx-a11y rules from error to warn
const jsxA11yWarnRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(
    ([key, value]) => [
      key,
      Array.isArray(value) ? ['warn', ...value.slice(1)] : 'warn',
    ],
  ),
)

export default defineConfig([
  // "**/dist" 而非 "dist"：flat config 的 ignore 模式相对配置文件所在目录解析，
  // 裸名只匹配仓库根 dist，apps/web/dist 与 apps/api/dist 会漏网被当源码扫。
  globalIgnores(['**/dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
      'project-rules': {
        rules: {
          'no-toisostring-slice': noToisostringSlice,
          'no-tailwind-raw-colors': noTailwindRawColors,
          'no-raw-viewport-check': noRawViewportCheck,
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
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'project-rules/no-toisostring-slice': 'warn',
      ...jsxA11yWarnRules,
    },
  },
  // ─── UI 层架构约束（apps/web）────────────────────────────────────────────
  // 1) 禁止 Tailwind 原色类（text-red-500 等），必须走语义化 token
  // 2) 禁止直读 window.innerWidth，窄屏分叉须走 useIsMobile() 或 CSS 断点类
  //
  // 存量违规走下面的 files: 永久豁免块并附理由（棘轮：清理完即从配置移除）；
  // 判据、盲区与设计理由写在 eslint-rules/*.js 的 JSDoc，不在本文件复述。
  {
    files: ['apps/web/src/pages/**/*.tsx', 'apps/web/src/components/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'project-rules/no-tailwind-raw-colors': 'error',
      'project-rules/no-raw-viewport-check': 'error',
    },
  },
  // no-raw-viewport-check 存量豁免：错误页鼠标视差特效的坐标归一化
  // （clientX/clientY 相对视口中心归一到 -1..1），不是窄屏结构分叉，
  // useIsMobile() 与 CSS 断点类都无法替代。棘轮：若改成 CSS/canvas 方案即从此移除。
  {
    files: [
      'apps/web/src/pages/ForbiddenPage.tsx',
      'apps/web/src/pages/NotFoundPage.tsx',
      'apps/web/src/pages/ServerErrorPage.tsx',
    ],
    rules: {
      'project-rules/no-raw-viewport-check': 'off',
    },
  },
])

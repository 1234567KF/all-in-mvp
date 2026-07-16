import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// 项目内置 ESLint 规则（针对时区坑：`.toISOString().slice(0, 10)` 在
// UTC+ 时区会把日期往前挪一天）。若不需要可移除本插件的注册与启用。
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
  globalIgnores(['dist']),
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
        },
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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
])

#!/usr/bin/env bun
/**
 * 架构约束检查（AGENTS.md 规范守护）
 *
 * 用法：bun run scripts/arch-check.ts
 * 退出码：0=通过 1=失败
 *
 * 检查项：
 *   1. UI 层（components/pages）禁止直接 import `@/lib/api`（应走 services/）
 *   2. UI 层禁止直接使用 axios / fetch 调后端
 *   3. 除 lib/toast.ts 与 App.tsx（Toaster）外，禁止直接 import "sonner"
 *   4. 页面文件（除 LoginPage）必须在 App.tsx 中通过 React.lazy 引入
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const WEB_SRC = join(ROOT, "apps/web/src")

interface Violation {
  rule: string
  file: string
  line: number
  code: string
}

const violations: Violation[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if ([".ts", ".tsx"].includes(extname(name)) && !name.endsWith(".d.ts") && !name.includes(".test.")) {
      out.push(p)
    }
  }
  return out
}

// sonner 直连白名单：wrapper 本身与 App.tsx 顶层 Toaster
const SONNER_ALLOWLIST = new Set([
  join(WEB_SRC, "lib/toast.ts"),
  join(WEB_SRC, "App.tsx"),
])

const files = walk(WEB_SRC)

for (const file of files) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, "utf-8").split("\n")
  const isUiLayer = rel.startsWith("apps/web/src/components/") || rel.startsWith("apps/web/src/pages/")

  lines.forEach((line, i) => {
    const lineNo = i + 1
    const trimmed = line.trim()

    // Rule 1: UI 层禁 @/lib/api
    if (isUiLayer && /from\s+["']@\/lib\/api["']/.test(trimmed)) {
      violations.push({ rule: "ui-no-direct-api", file: rel, line: lineNo, code: trimmed })
    }

    // Rule 2: UI 层禁 axios / fetch 直连
    if (isUiLayer && /from\s+["']axios["']/.test(trimmed)) {
      violations.push({ rule: "ui-no-axios", file: rel, line: lineNo, code: trimmed })
    }

    // Rule 3: 除白名单外禁 import "sonner"
    if (/from\s+["']sonner["']/.test(trimmed) && !SONNER_ALLOWLIST.has(file)) {
      violations.push({ rule: "no-direct-sonner", file: rel, line: lineNo, code: trimmed })
    }
  })
}

// Rule 4: 页面文件必须在 App.tsx 中通过 React.lazy 引入（除 LoginPage）
const appTsxPath = join(WEB_SRC, "App.tsx")
const appSrc = readFileSync(appTsxPath, "utf-8")
const pagesDir = join(WEB_SRC, "pages")
const pageFiles = walk(pagesDir).filter((f) => f.endsWith(".tsx"))
for (const pageFile of pageFiles) {
  const base = pageFile.split("/").pop()!.replace(/\.tsx$/, "")
  // 跳过 LoginPage 与 index 类文件
  if (base === "LoginPage" || base.startsWith("_")) continue
  // 只关注顶层「Page」文件（子组件不算）
  if (!base.endsWith("Page")) continue
  // 允许两种引法：React.lazy(...) 或 lazy(...)
  const pathHint = relative(WEB_SRC, pageFile).replace(/\.tsx$/, "")
  const lazyRe = new RegExp(`lazy\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*["']@?/?${pathHint.replace(/\//g, "\\/")}["']`)
  const importedDirect = new RegExp(`import\\s+[A-Za-z]+\\s+from\\s+["']@\\/${pathHint.replace(/\//g, "\\/")}["']`)

  const lazyMatch = lazyRe.test(appSrc)
  const directMatch = importedDirect.test(appSrc)

  if (directMatch && !lazyMatch) {
    violations.push({
      rule: "page-must-lazy",
      file: relative(ROOT, pageFile),
      line: 1,
      code: `${base} 被直接 import，应使用 React.lazy()`,
    })
  }
}

if (violations.length > 0) {
  console.error(`❌ 架构约束检查失败（${violations.length} 项）：\n`)
  const byRule = new Map<string, Violation[]>()
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, [])
    byRule.get(v.rule)!.push(v)
  }
  const ruleDesc: Record<string, string> = {
    "ui-no-direct-api": "UI 层禁止直接 import @/lib/api（应封装到 services/）",
    "ui-no-axios": "UI 层禁止直接 import axios（应封装到 services/）",
    "no-direct-sonner": "禁止直接 import sonner，请使用 @/lib/toast",
    "page-must-lazy": "页面文件必须在 App.tsx 中通过 React.lazy() 引入",
  }
  for (const [rule, list] of byRule) {
    console.error(`▸ [${rule}] ${ruleDesc[rule]}`)
    for (const v of list) console.error(`   ${v.file}:${v.line}  ${v.code}`)
    console.error("")
  }
  process.exit(1)
}

console.log(`✅ 架构约束检查通过（扫描 ${files.length} 个文件）`)

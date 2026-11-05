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
 *   5. 单文件行数棘轮：pages 下 .tsx 与 api modules 下 .ts 超过 450 行即失败；
 *      存量超长文件列入 LONG_FILE_RATCHET，行数必须等于基线——只许下调、不许回涨
 *      （行数口径同 `wc -l`；web 对应 AGENTS.md「页面拆分标准」）
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

// Windows 下 URL.pathname 得到 "/D:/..."，join 后变成 "\D:\..." → readdirSync 直接 ENOENT。
// 必须用 fileURLToPath 转换（框架仓血案 B021；上游至今仍是 URL.pathname）。
const ROOT = fileURLToPath(new URL("..", import.meta.url))
// relative() 在 Windows 返回反斜杠；凡是拿它做 startsWith / 白名单 key / 正则片段的地方
// 都必须先归一成 posix，否则 Rule 1/2/4/5 在 Windows 静默不触发或匹配不到基线。
const toPosix = (path: string) => path.replace(/\\/g, "/")
const relOf = (base: string, target: string) => toPosix(relative(base, target))
const WEB_SRC = join(ROOT, "apps/web/src")
const PAGES_DIR = join(WEB_SRC, "pages")
const API_MODULES = join(ROOT, "apps/api/src/modules")

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
    else if (
      [".ts", ".tsx"].includes(extname(name)) &&
      !name.endsWith(".d.ts") &&
      !name.includes(".test.")
    ) {
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
  const rel = relOf(ROOT, file)
  const lines = readFileSync(file, "utf-8").split("\n")
  const isUiLayer =
    rel.startsWith("apps/web/src/components/") ||
    rel.startsWith("apps/web/src/pages/")

  lines.forEach((line, i) => {
    const lineNo = i + 1
    const trimmed = line.trim()

    // Rule 1: UI 层禁 @/lib/api
    if (isUiLayer && /from\s+["']@\/lib\/api["']/.test(trimmed)) {
      violations.push({
        rule: "ui-no-direct-api",
        file: rel,
        line: lineNo,
        code: trimmed,
      })
    }

    // Rule 2: UI 层禁 axios / fetch 直连
    if (isUiLayer && /from\s+["']axios["']/.test(trimmed)) {
      violations.push({
        rule: "ui-no-axios",
        file: rel,
        line: lineNo,
        code: trimmed,
      })
    }

    // Rule 3: 除白名单外禁 import "sonner"
    if (/from\s+["']sonner["']/.test(trimmed) && !SONNER_ALLOWLIST.has(file)) {
      violations.push({
        rule: "no-direct-sonner",
        file: rel,
        line: lineNo,
        code: trimmed,
      })
    }
  })
}

// Rule 4: 页面文件必须在 App.tsx 中通过 React.lazy 引入（除 LoginPage）
const appTsxPath = join(WEB_SRC, "App.tsx")
const appSrc = readFileSync(appTsxPath, "utf-8")
const pageFiles = walk(PAGES_DIR).filter((f) => f.endsWith(".tsx"))
for (const pageFile of pageFiles) {
  const base = toPosix(pageFile)
    .split("/")
    .pop()!
    .replace(/\.tsx$/, "")
  // 跳过 LoginPage 与 index 类文件
  if (base === "LoginPage" || base.startsWith("_")) continue
  // 只关注顶层「Page」文件（子组件不算）
  if (!base.endsWith("Page")) continue
  // 允许两种引法：React.lazy(...) 或 lazy(...)
  const pathHint = relOf(WEB_SRC, pageFile).replace(/\.tsx$/, "")
  const lazyRe = new RegExp(
    `lazy\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*["']@?/?${pathHint.replace(/\//g, "\\/")}["']`
  )
  const importedDirect = new RegExp(
    `import\\s+[A-Za-z]+\\s+from\\s+["']@\\/${pathHint.replace(/\//g, "\\/")}["']`
  )

  const lazyMatch = lazyRe.test(appSrc)
  const directMatch = importedDirect.test(appSrc)

  if (directMatch && !lazyMatch) {
    violations.push({
      rule: "page-must-lazy",
      file: relOf(ROOT, pageFile),
      line: 1,
      code: `${base} 被直接 import，应使用 React.lazy()`,
    })
  }
}

// Rule 5: 单文件行数棘轮（pages 下 .tsx + api modules 下 .ts）
// 行数口径与 `wc -l` 一致：按换行计行，末尾换行不额外多计一行（无末尾换行的最后一行计入）。
// 本文件所有基线都按此口径，勿改用 split("\n").length——后者对末尾换行的文件会多 1 行。
const MAX_LINES = 450

/**
 * 存量超长文件棘轮白名单：key 为相对仓库根目录的 posix 路径，value 为基线行数。
 * 「只许减不许增」由脚本双向强制：行数高于基线报 exceeded；低于基线也必须同步下调
 * 基线（否则基线会虚高、日后回涨到旧值仍能通过），降到 450 行以内须移除条目。
 * 条目对应文件删除/改名/移出扫描范围即视为失效，须移除。
 */
const LONG_FILE_RATCHET: Record<string, number> = {
  "apps/web/src/pages/OverlaysPage.tsx": 1012,
  "apps/web/src/pages/SystemSettingsPage.tsx": 853,
  "apps/web/src/pages/FormsPage.tsx": 562,
  "apps/web/src/pages/DataPage.tsx": 534,
}

/** 行数口径同 `wc -l`：末尾换行不额外计行；空文件为 0 行。 */
function countLines(file: string): number {
  const content = readFileSync(file, "utf-8")
  if (content === "") return 0
  const lines = content.split("\n")
  return content.endsWith("\n") ? lines.length - 1 : lines.length
}

const lineCheckFiles = [
  ...walk(PAGES_DIR).filter((f) => f.endsWith(".tsx")),
  ...walk(API_MODULES).filter((f) => f.endsWith(".ts")),
]
const scannedRelPaths = new Set<string>()
for (const file of lineCheckFiles) {
  // key 统一 posix 形式，避免 Windows 下 relative() 返回反斜杠导致白名单不匹配
  const rel = relOf(ROOT, file)
  scannedRelPaths.add(rel)
  const lineCount = countLines(file)
  const baseline = LONG_FILE_RATCHET[rel]

  if (baseline === undefined) {
    if (lineCount > MAX_LINES) {
      violations.push({
        rule: "file-too-long",
        file: rel,
        line: MAX_LINES + 1,
        code: `${lineCount} 行（上限 ${MAX_LINES} 行），${
          rel.startsWith("apps/api/")
            ? "请按 AGENTS.md「后端模块化」拆分：route 保持薄，业务下沉 service / 子模块"
            : "请按 AGENTS.md「页面拆分标准」拆到 components/ 或 hooks/"
        }`,
      })
    }
    continue
  }

  if (lineCount > baseline) {
    violations.push({
      rule: "overlong-ratchet-exceeded",
      file: rel,
      line: baseline + 1,
      code: `棘轮只许减不许增：当前 ${lineCount} 行 > 基线 ${baseline} 行`,
    })
  } else if (lineCount <= MAX_LINES) {
    violations.push({
      rule: "overlong-ratchet-stale",
      file: rel,
      line: 1,
      code: `已降到 ${MAX_LINES} 行阈值内（当前 ${lineCount} 行），请从 LONG_FILE_RATCHET 移除`,
    })
  } else if (lineCount < baseline) {
    violations.push({
      rule: "overlong-ratchet-unlowered",
      file: rel,
      line: 1,
      code: `当前 ${lineCount} 行已低于基线 ${baseline} 行：请把 LONG_FILE_RATCHET 基线同步下调为 ${lineCount}（棘轮只许减不许增）`,
    })
  }
}

// 白名单条目失效检查：文件已不存在或已不在扫描范围内
for (const [rel, baseline] of Object.entries(LONG_FILE_RATCHET)) {
  if (!scannedRelPaths.has(rel)) {
    violations.push({
      rule: "overlong-ratchet-missing",
      file: rel,
      line: 1,
      code: `白名单条目失效（文件不存在或不在扫描范围内），请移除（基线 ${baseline} 行）`,
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
    "file-too-long":
      "单文件超过 450 行，请按 AGENTS.md 拆分（web 走「页面拆分标准」，api 走「后端模块化」）",
    "overlong-ratchet-exceeded": "存量超长文件棘轮只许减不许增（已超出基线）",
    "overlong-ratchet-stale":
      "已降到 450 行阈值内，请从 LONG_FILE_RATCHET 移除",
    "overlong-ratchet-unlowered":
      "当前行数低于基线，请同步下调 LONG_FILE_RATCHET 基线（棘轮只许减）",
    "overlong-ratchet-missing": "LONG_FILE_RATCHET 白名单条目失效，请移除",
  }
  for (const [rule, list] of byRule) {
    console.error(`▸ [${rule}] ${ruleDesc[rule]}`)
    for (const v of list) console.error(`   ${v.file}:${v.line}  ${v.code}`)
    console.error("")
  }
  process.exit(1)
}

console.log(
  `✅ 架构约束检查通过（web 扫描 ${files.length} 个文件；行数检查 ${lineCheckFiles.length} 个文件）`
)

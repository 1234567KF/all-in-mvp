# Gate: R022-R026 — Liquid Glass 风格 / 架构约束 (v2.20)
# 镜像脚手架 scripts/arch-check.ts 的四条架构规则，并补充 R026 硬编码颜色检查
#   R022 UI 层禁止直接 import @/lib/api（应走 services/）
#   R023 UI 层禁止直接 import axios / 裸 fetch
#   R024 除 lib/toast.ts 与 App.tsx 外禁止 import "sonner"
#   R025 页面文件必须 React.lazy 引入（LoginPage 除外）
#   R026 禁止硬编码 hex/rgba 与 Tailwind 原始色类（用 --lg-* 变量）
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出

$ErrorActionPreference = "Continue"
$violations = @()

# ── 定位 web 源码目录 ─────────────────────────────────────────────
$webSrc = $null
if (Test-Path (Join-Path $TargetDir "apps/web/src")) {
    $webSrc = (Join-Path $TargetDir "apps/web/src")
} elseif (Test-Path (Join-Path $TargetDir "src")) {
    $webSrc = (Join-Path $TargetDir "src")
}

if (-not $webSrc) {
    if ($Json) {
        Write-Output '{"status":"PASS","rule":"R022-R026","skipped":true,"message":"未检测到 apps/web/src 或 src，跳过风格检查"}'
    } else {
        Write-Host "[PASS] R022-R026 Liquid Glass 风格检查 — 未检测到前端源码目录，跳过" -ForegroundColor Green
    }
    exit 0
}

$webSrc = (Resolve-Path $webSrc).Path

# ── 收集 .ts/.tsx ────────────────────────────────────────────────
$files = Get-ChildItem -Path $webSrc -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" -and
        $_.Name -notlike "*.test.*" -and
        $_.Name -notlike "*.d.ts"
    }

function Get-RelPath([string]$full) {
    $rel = $full.Substring($webSrc.Length).TrimStart('\', '/')
    return ($rel -replace '\\', '/')
}

function Add-Violation([string]$Rel, [int]$Line, [string]$Rule, [string]$Message) {
    $script:violations += [PSCustomObject]@{
        File = $Rel
        Line = $Line
        Rule = $Rule
        Message = $Message
    }
}

# ── 逐文件检查 ──────────────────────────────────────────────────
foreach ($file in $files) {
    $rel = Get-RelPath $file.FullName
    $isUiLayer = ($rel -match '^(pages|components)/')
    # R026 排除 shadcn 基础件（其内部可能含图表色值）
    $isUiKit = ($rel -match '^components/ui/')
    $isToastWrapper = ($rel -eq 'lib/toast.ts')
    $isApp = ($rel -eq 'App.tsx')
    # 脚手架自带的展示/错误演示页：刻意展示原始色值，不属于业务代码
    $isShowcase = ($rel -match '^pages/(FoundationsPage|ComponentsOverviewPage|OverlaysPage|FormsPage|DataPage|VirtualTableDemoPage|ForbiddenPage|NotFoundPage|ServerErrorPage|ResultPage)\.tsx$')

    $lines = @(Get-Content -Path $file.FullName -ErrorAction SilentlyContinue)
    if ($lines.Count -eq 0) { continue }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $lineNo = $i + 1
        $line = [string]$lines[$i]
        $trimmed = $line.Trim()

        # 支持行内豁免：// gate-ignore Rxxx
        $ignore = $false
        if ($trimmed -match 'gate-ignore\s+(R\d+)') {
            $ignoreRule = $Matches[1]
            if ($ignoreRule -eq 'R022' -or $ignoreRule -eq 'R023' -or $ignoreRule -eq 'R024' -or $ignoreRule -eq 'R025' -or $ignoreRule -eq 'R026') { $ignore = $true }
        }

        # R022: UI 层禁 @/lib/api
        if (-not $ignore -and $isUiLayer -and $trimmed -match 'from\s+["'']@/lib/api["'']') {
            Add-Violation $rel $lineNo "R022" "UI 层禁止直接 import @/lib/api，应封装到 services/"
        }

        # R023: UI 层禁 axios / 裸 fetch
        if (-not $ignore -and $isUiLayer -and $trimmed -match 'from\s+["'']axios["'']') {
            Add-Violation $rel $lineNo "R023" "UI 层禁止直接 import axios，应封装到 services/"
        }
        if (-not $ignore -and $isUiLayer -and $trimmed -match '\bfetch\s*\(' -and $trimmed -notmatch '^\s*(//|\*)') {
            Add-Violation $rel $lineNo "R023" "UI 层禁止裸 fetch，应封装到 services/"
        }

        # R024: 禁直连 sonner（白名单 lib/toast.ts 与 App.tsx）
        if (-not $ignore -and -not $isToastWrapper -and -not $isApp -and $trimmed -match 'from\s+["'']sonner["'']') {
            Add-Violation $rel $lineNo "R024" "禁止直接 import sonner，请使用 @/lib/toast"
        }

        # R026: 硬编码颜色 / Tailwind 原始色类
        if (-not $ignore -and -not $isUiKit -and -not $isShowcase -and $trimmed -notmatch '^\s*(//|\*|/\*)') {
            if ($trimmed -match '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*[0-9]') {
                Add-Violation $rel $lineNo "R026" "禁止硬编码 hex/rgba 颜色，请用 --lg-* CSS 变量"
            }
            if ($trimmed -match '\b(?:text|bg|border|ring|fill|stroke|from|to|via)-(?:red|green|blue|yellow|orange|purple|pink|gray|slate|zinc|neutral|stone|indigo|violet|cyan|teal|emerald|lime|amber|rose|sky|fuchsia)-[0-9]{2,3}\b') {
                Add-Violation $rel $lineNo "R026" "禁止 Tailwind 原始色类，请用语义变量或 variant"
            }
        }
    }
}

# ── R025: 页面必须 React.lazy（LoginPage 除外）────────────────────
$appTsx = Join-Path $webSrc "App.tsx"
$pagesDir = Join-Path $webSrc "pages"
if ((Test-Path $appTsx) -and (Test-Path $pagesDir)) {
    $appSrc = Get-Content -Path $appTsx -Raw -ErrorAction SilentlyContinue
    $pageFiles = Get-ChildItem -Path $pagesDir -Recurse -Include "*.tsx" -ErrorAction SilentlyContinue |
        Where-Object { -not $_.Name.StartsWith("_") }

    foreach ($pageFile in $pageFiles) {
        $base = $pageFile.Name -replace '\.tsx$', ''
        if ($base -eq 'LoginPage' -or -not $base.EndsWith('Page')) { continue }

        $rel = Get-RelPath $pageFile.FullName
        $pathHint = ($rel -replace '\.tsx$', '')
        $hintEsc = [regex]::Escape($pathHint)

        $lazyRe = "lazy\(\s*\(\s*\)\s*=>\s*import\(\s*[""']@?/?$hintEsc[""']"
        $directRe = "import\s+[A-Za-z0-9_]+\s+from\s+[""']@/$hintEsc[""']"

        $hasLazy = $appSrc -match $lazyRe
        $hasDirect = $appSrc -match $directRe
        if ($hasDirect -and -not $hasLazy) {
            Add-Violation $rel 1 "R025" "$base 被直接 import，应在 App.tsx 中用 React.lazy() 引入"
        }
    }
}

# ── 输出 ────────────────────────────────────────────────────────
if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R022-R026`",`"scanned`":$($files.Count)}"
    } else {
        Write-Host "[PASS] R022-R026 Liquid Glass 风格检查 — 扫描 $($files.Count) 个文件，无违规" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $json = $violations | ConvertTo-Json -Compress
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R022-R026`",`"violations`":$($violations.Count),`"details`":$json}"
    } else {
        Write-Host "[FAIL] R022-R026 Liquid Glass 风格检查 — 发现 $($violations.Count) 处违规：" -ForegroundColor Red
        foreach ($v in $violations) {
            Write-Host "  [$($v.Rule)] $($v.File):$($v.Line) — $($v.Message)" -ForegroundColor Yellow
        }
        Write-Host "  豁免：在该行加 // gate-ignore Rxxx（仅限确有必要的场景）" -ForegroundColor Cyan
    }
    exit 1
}

# ============================================================
# all-in-mvp 安装自检 — 用户级注册 / 工作区资产 / 运行前置
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/verify-all-in-mvp.ps1
#   -Json  机器可读输出
# 退出码: 0 = 全部 PASS（WARN 不阻断）; 1 = 存在 FAIL
# ============================================================
param(
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$ErrorActionPreference = "Continue"

$rows = @()
function Add-Row {
    param([string]$Area, [string]$Item, [string]$Status, [string]$Detail)
    $script:rows += [PSCustomObject]@{ Area = $Area; Item = $Item; Status = $Status; Detail = $Detail }
}

# ── 1. Qoder home 探测（桌面/CLI 用 .qoder-cn，IDE 用 .qoder）──────
$Homes = @(".qoder-cn", ".qoder") | ForEach-Object { Join-Path $env:USERPROFILE $_ } | Where-Object { Test-Path $_ }
if (-not $Homes) {
    Add-Row "home" "Qoder 用户目录" "FAIL" "未找到 ~/.qoder-cn 或 ~/.qoder"
} else {
    foreach ($h in $Homes) {
        $name = Split-Path -Leaf $h
        $skillDirs = @(Get-ChildItem -Path (Join-Path $h "skills") -Directory -ErrorAction SilentlyContinue)
        $hasMain = Test-Path (Join-Path $h "skills\all-in-mvp\SKILL.md")
        $agentCount = @(Get-ChildItem -Path (Join-Path $h "agents") -Filter "mvp-*.md" -ErrorAction SilentlyContinue).Count
        Add-Row "home" "$name/skills" $(if ($hasMain) { "PASS" } else { "WARN" }) ("共 " + $skillDirs.Count + " 个技能目录；all-in-mvp " + $(if ($hasMain) { "已注册" } else { "缺失 -> 该 home 下无法全局召回" }))
        Add-Row "home" "$name/agents" $(if ($agentCount -ge 18) { "PASS" } elseif ($agentCount -gt 0) { "WARN" } else { "FAIL" }) ("mvp-*.md 子 Agent " + $agentCount + " / 18")
        $fw = Join-Path $h "frameworks\all-in-mvp"
        Add-Row "home" "$name/frameworks" $(if (Test-Path $fw) { "PASS" } else { "WARN" }) $(if (Test-Path $fw) { "bootstrap 真源就绪" } else { "缺 -> bootstrap 无法补齐工作区资产" })
        $bs = Join-Path $h "scripts\bootstrap-all-in-mvp.ps1"
        Add-Row "home" "$name/scripts/bootstrap" $(if (Test-Path $bs) { "PASS" } else { "WARN" }) $(if (Test-Path $bs) { "入口脚本存在" } else { "缺 -> 按 README 全局安装步骤补一份" })
    }
}

# ── 2. 用户级技能的 frontmatter 可读性（BOM 会让 description 解析失败）──
foreach ($h in $Homes) {
    $bad = @()
    Get-ChildItem -Path (Join-Path $h "skills") -Recurse -Filter "SKILL.md" -ErrorAction SilentlyContinue | ForEach-Object {
        $b = [System.IO.File]::ReadAllBytes($_.FullName)
        if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { $bad += $_.Name }
    }
    Add-Row "encoding" "$h SKILL.md 无 BOM" $(if ($bad.Count -eq 0) { "PASS" } else { "FAIL" }) $(if ($bad.Count -eq 0) { "frontmatter 从字节 0 开始" } else { "带 BOM: " + ($bad -join ", ") })
}

# ── 3. 当前工作区门禁资产 ─────────────────────────────────────
$ws = (Get-Location).Path
Add-Row "workspace" "gate-rules.yaml" $(if (Test-Path ".qoder\gate-rules.yaml") { "PASS" } else { "FAIL" }) ".qoder/gate-rules.yaml（规则单一真源）"
$scriptCount = @(Get-ChildItem -Path ".qoder\scripts" -Filter "check-*.ps1" -ErrorAction SilentlyContinue).Count
Add-Row "workspace" "门禁脚本" $(if ($scriptCount -ge 8) { "PASS" } elseif ($scriptCount -gt 0) { "WARN" } else { "FAIL" }) "check-*.ps1 共 $scriptCount 个"
Add-Row "workspace" "quality-gate-hook.ps1" $(if (Test-Path ".qoder\scripts\quality-gate-hook.ps1") { "PASS" } else { "FAIL" }) "PostToolUse 入口"
$rules = @(Get-ChildItem -Path ".qoder\rules" -Filter "*.md" -ErrorAction SilentlyContinue).Count
Add-Row "workspace" "rules/*.md" $(if ($rules -gt 0) { "PASS" } else { "WARN" }) "$rules 个（自动加载进上下文）"

# settings.json 是否声明了 hooks.PostToolUse
$cfgPath = ".qoder\settings.json"
if (Test-Path $cfgPath) {
    $raw = [System.IO.File]::ReadAllText($cfgPath)
    $ok = ($raw -match '"PostToolUse"' -and $raw -match 'quality-gate-hook')
    Add-Row "workspace" "settings.json hooks" $(if ($ok) { "PASS" } else { "FAIL" }) $(if ($ok) { "PostToolUse -> quality-gate-hook.ps1" } else { "缺 hooks -> 门禁不会自动触发，跑 bootstrap 合并" })
} else {
    Add-Row "workspace" "settings.json" "FAIL" "不存在 -> 跑 bootstrap 生成"
}

# ── 4. 运行前置（Node/Bun/npx；Stage3 TDD 与 Stage4 E2E 依赖）──
foreach ($t in @(@{ n = "node"; need = "REQUIRED" }, @{ n = "bun"; need = "REQUIRED" }, @{ n = "npx"; need = "WARN" })) {
    $cmd = Get-Command $t.n -ErrorAction SilentlyContinue
    if ($cmd) {
        $ver = & $t.n --version 2>&1 | Select-Object -First 1
        Add-Row "runtime" $t.n "PASS" "$ver"
    } else {
        Add-Row "runtime" $t.n $(if ($t.need -eq "REQUIRED") { "FAIL" } else { "WARN" }) "不在 PATH -> Stage3 TDD / Stage4 E2E / Starter 构建无法执行"
    }
}
$pw = Join-Path $env:USERPROFILE "AppData\Local\ms-playwright"
# 只判目录存在会把"正在下载（目录里只有 __dirlock）"报成已安装 —— 必须验浏览器可执行文件本体（同 B022 教训）
$chrome = if (Test-Path $pw) { Get-ChildItem -Path $pw -Filter "chrome.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
if ($chrome) {
    Add-Row "runtime" "Playwright 浏览器" "PASS" $chrome.FullName
} elseif (Test-Path $pw) {
    Add-Row "runtime" "Playwright 浏览器" "WARN" "目录存在但缺 chrome.exe（下载未完成？）-> bunx playwright install chromium"
} else {
    Add-Row "runtime" "Playwright 浏览器" "WARN" "未安装 -> E2E 需 bunx playwright install chromium"
}

# ── 输出 ─────────────────────────────────────────────────────
$fails = @($rows | Where-Object { $_.Status -eq "FAIL" }).Count
$warns = @($rows | Where-Object { $_.Status -eq "WARN" }).Count
$passes = @($rows | Where-Object { $_.Status -eq "PASS" }).Count

if ($Json) {
    [PSCustomObject]@{
        status  = $(if ($fails -eq 0) { "PASS" } else { "FAIL" })
        pass    = $passes; warn = $warns; fail = $fails
        details = $rows
    } | ConvertTo-Json -Depth 6 -Compress
} else {
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " all-in-mvp 安装自检 — $ws" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    foreach ($r in $rows) {
        $c = "Green"; if ($r.Status -eq "WARN") { $c = "Yellow" }; if ($r.Status -eq "FAIL") { $c = "Red" }
        Write-Host ("  [{0,-4}] {1,-10} {2,-26} {3}" -f $r.Status, $r.Area, $r.Item, $r.Detail) -ForegroundColor $c
    }
    Write-Host ""
    Write-Host "结果: $passes PASS / $warns WARN / $fails FAIL" -ForegroundColor Cyan
}

if ($fails -gt 0) { exit 1 } else { exit 0 }

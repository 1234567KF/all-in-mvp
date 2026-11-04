# Bootstrap: all-in-mvp 全局框架 -> 当前工作区 (v2.20)
# 作用：其他工作区首次使用 all-in-mvp 技能时，一次补齐门禁资产与 React 脚手架
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.qoder\scripts\bootstrap-all-in-mvp.ps1"
#   powershell ... -TargetDir D:\my-project -Force
#   powershell ... -SkipScaffold          # 只补门禁资产，不复制 2.6MB 脚手架
param(
    [string]$TargetDir = "",
    [switch]$Force,
    [switch]$SkipScaffold,
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出

$ErrorActionPreference = "Continue"
# Qoder 有两个 home：桌面/CLI（CN 版）用 .qoder-cn，IDE 版用 .qoder。优先在用的那个。
$FrameworkHome = ""
foreach ($h in @(".qoder-cn", ".qoder")) {
    $cand = Join-Path $env:USERPROFILE "$h\frameworks\all-in-mvp"
    if (Test-Path $cand) { $FrameworkHome = $cand; break }
}

if (-not $FrameworkHome) {
    $msg = "全局框架目录不存在（已查找 ~/.qoder-cn/frameworks/all-in-mvp 与 ~/.qoder/frameworks/all-in-mvp）。请先完成全局注册（复制 .qoder 到 <home>/frameworks/all-in-mvp）。"
    if ($Json) {
        [PSCustomObject]@{ status = "FAIL"; message = $msg } | ConvertTo-Json -Compress
    } else {
        Write-Host "[FAIL] $msg" -ForegroundColor Red
    }
    exit 1
}

# ── 解析目标工作区（优先 git 根目录）──────────────────────────────
if (-not $TargetDir) {
    $gitRoot = & git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitRoot) {
        $TargetDir = $gitRoot.Trim()
    } else {
        $TargetDir = (Get-Location).Path
    }
}
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}
$TargetDir = (Resolve-Path $TargetDir).Path

$results = @()

function Copy-Asset {
    param(
        [string]$Name,
        [string]$Source,
        [string]$Destination,
        [switch]$IsDirectory
    )
    if (-not (Test-Path $Source)) {
        $script:results += [PSCustomObject]@{ Asset = $Name; Status = "MISSING_SOURCE"; Path = $Source }
        return
    }
    if ((Test-Path $Destination) -and -not $Force) {
        $script:results += [PSCustomObject]@{ Asset = $Name; Status = "SKIPPED"; Path = $Destination }
        return
    }
    $parent = Split-Path -Parent $Destination
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    if ($IsDirectory) {
        if (Test-Path $Destination) { Remove-Item -Path $Destination -Recurse -Force }
        Copy-Item -Path $Source -Destination $Destination -Recurse -Force
    } else {
        Copy-Item -Path $Source -Destination $Destination -Force
    }
    $script:results += [PSCustomObject]@{ Asset = $Name; Status = "COPIED"; Path = $Destination }
}

# ── 1. 门禁真源 ────────────────────────────────────────────────
Copy-Asset -Name "gate-rules.yaml" -Source (Join-Path $FrameworkHome "gate-rules.yaml") -Destination (Join-Path $TargetDir ".qoder\gate-rules.yaml")
Copy-Asset -Name "PLAYBOOK.md" -Source (Join-Path $FrameworkHome "PLAYBOOK.md") -Destination (Join-Path $TargetDir ".qoder\PLAYBOOK.md")
Copy-Asset -Name "rules/quality-gate.md" -Source (Join-Path $FrameworkHome "rules\quality-gate.md") -Destination (Join-Path $TargetDir ".qoder\rules\quality-gate.md")

# ── 1b. hooks 配置（缺则写入；已有 settings.json 则合并 hooks，不覆盖用户其他配置）──────
$settingsDst = Join-Path $TargetDir ".qoder\settings.json"
$settingsSrc = Join-Path $FrameworkHome "settings.hooks.json"
if (-not (Test-Path $settingsSrc)) {
    $results += [PSCustomObject]@{ Asset = "settings.hooks.json"; Status = "MISSING_SOURCE"; Path = $settingsSrc }
} elseif (-not (Test-Path $settingsDst)) {
    Copy-Item -Path $settingsSrc -Destination $settingsDst -Force
    $results += [PSCustomObject]@{ Asset = "settings.json (hooks)"; Status = "COPIED"; Path = $settingsDst }
} else {
    $raw = [System.IO.File]::ReadAllText($settingsDst)
    try { $obj = $raw | ConvertFrom-Json } catch { $obj = $null }
    if ($null -eq $obj) {
        $results += [PSCustomObject]@{ Asset = "settings.json"; Status = "SKIPPED"; Path = "$settingsDst (JSON 解析失败，请手工并入 hooks)" }
    } else {
        $hasGateHook = ($raw -match "quality-gate-hook")
        if ($hasGateHook -and -not $Force) {
            $results += [PSCustomObject]@{ Asset = "settings.json (hooks)"; Status = "SKIPPED"; Path = "$settingsDst (已含 quality-gate-hook)" }
        } else {
            # 合并：保留原有键，补 hooks.PostToolUse（matcher = Write|Edit|MultiEdit）
            $hookTemplate = [System.IO.File]::ReadAllText($settingsSrc) | ConvertFrom-Json
            if ($obj.PSObject.Properties.Name -contains "hooks") {
                $obj.hooks = $hookTemplate.hooks
            } else {
                $obj | Add-Member -NotePropertyName hooks -NotePropertyValue $hookTemplate.hooks -Force
            }
            $merged = $obj | ConvertTo-Json -Depth 20
            # UTF-8 无 BOM 写回（BOM 会破坏配置解析）
            [System.IO.File]::WriteAllText($settingsDst, $merged, (New-Object System.Text.UTF8Encoding($false)))
            $results += [PSCustomObject]@{ Asset = "settings.json (hooks merged)"; Status = "COPIED"; Path = $settingsDst }
        }
    }
}

# ── 2. 门禁脚本 ────────────────────────────────────────────────
$scriptSrc = Join-Path $FrameworkHome "scripts"
if (Test-Path $scriptSrc) {
    Get-ChildItem -Path $scriptSrc -Filter "*.ps1" | ForEach-Object {
        Copy-Asset -Name ("scripts/" + $_.Name) -Source $_.FullName -Destination (Join-Path $TargetDir ".qoder\scripts\$($_.Name)")
    }
} else {
    $results += [PSCustomObject]@{ Asset = "scripts/"; Status = "MISSING_SOURCE"; Path = $scriptSrc }
}

# ── 3. Qoder 子 Agent ──────────────────────────────────────────
$agentSrc = Join-Path $FrameworkHome "agents"
if (Test-Path $agentSrc) {
    Get-ChildItem -Path $agentSrc -Filter "*.md" | ForEach-Object {
        Copy-Asset -Name ("agents/" + $_.Name) -Source $_.FullName -Destination (Join-Path $TargetDir ".qoder\agents\$($_.Name)")
    }
} else {
    $results += [PSCustomObject]@{ Asset = "agents/"; Status = "MISSING_SOURCE"; Path = $agentSrc }
}

# ── 4. 技能共享 references（21 个 kf-mvp-* 技能按此路径加载技术栈/模板）──
Copy-Asset -Name "skills/references/" -Source (Join-Path $FrameworkHome "skills\references") -Destination (Join-Path $TargetDir ".qoder\skills\references") -IsDirectory

# ── 5. React 权威脚手架 ────────────────────────────────────────
if (-not $SkipScaffold) {
    Copy-Asset -Name "starters/liquid-glass-frontend/" -Source (Join-Path $FrameworkHome "starters\liquid-glass-frontend") -Destination (Join-Path $TargetDir "starters\liquid-glass-frontend") -IsDirectory
}

# ── 输出 ───────────────────────────────────────────────────────
$copied = @($results | Where-Object { $_.Status -eq "COPIED" }).Count
$skipped = @($results | Where-Object { $_.Status -eq "SKIPPED" }).Count
$missing = @($results | Where-Object { $_.Status -eq "MISSING_SOURCE" }).Count
if ($missing -eq 0) { $status = "PASS" } else { $status = "FAIL" }

if ($Json) {
    [PSCustomObject]@{
        status = $status
        target = $TargetDir
        copied = $copied
        skipped = $skipped
        missing = $missing
        details = $results
    } | ConvertTo-Json -Compress
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " all-in-mvp Bootstrap -> $TargetDir" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    foreach ($r in $results) {
        switch ($r.Status) {
            "COPIED" { Write-Host "  [COPIED]  $($r.Asset)" -ForegroundColor Green }
            "SKIPPED" { Write-Host "  [SKIP]    $($r.Asset) (已存在)" -ForegroundColor DarkGray }
            "MISSING_SOURCE" { Write-Host "  [MISSING] $($r.Asset) <- $($r.Path)" -ForegroundColor Red }
        }
    }
    Write-Host ""
    Write-Host "结果: $copied COPIED / $skipped SKIPPED / $missing MISSING" -ForegroundColor Cyan
    if ($missing -gt 0) {
        Write-Host "[FAIL] 全局框架不完整，请重新同步 ~/.qoder/frameworks/all-in-mvp" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "[PASS] 工作区已具备 all-in-mvp 门禁资产" -ForegroundColor Green
        exit 0
    }
}

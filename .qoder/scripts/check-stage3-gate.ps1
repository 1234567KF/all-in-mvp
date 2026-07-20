# ============================================================
# Stage 3 聚合门禁 — 开发前入口检查
# 调用所有 Stage 3 适用的规则检测脚本
# 用法: powershell -File .qoder/scripts/check-stage3-gate.ps1 [-TargetDir .]
# ============================================================
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = @()
$passed = @()
$total = 0

function Invoke-Check {
    param([string]$ScriptName, [string]$RuleId)

    $scriptPath = Join-Path $ScriptDir $ScriptName
    if (-not (Test-Path $scriptPath)) {
        $script:failed += [PSCustomObject]@{ Rule = $RuleId; Script = $ScriptName; Error = "Script not found" }
        return
    }

    $result = & powershell -NoProfile -File $scriptPath -TargetDir $TargetDir -Json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $script:passed += $RuleId
    } else {
        $script:failed += [PSCustomObject]@{ Rule = $RuleId; Script = $ScriptName; Output = ($result -join "`n") }
    }
    $script:total++
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Stage 3 Gate — 开发前强制门禁" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Stage 3 规则清单 (对应 gate-rules.yaml gates.stage3.rules)
Invoke-Check -ScriptName "check-api-path-source.ps1" -RuleId "R012"
Invoke-Check -ScriptName "check-silent-catch.ps1" -RuleId "R015"
# R002/R004 暂不可脚本化，由 Agent 自检

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Stage 3 Gate 结果: $($passed.Count) PASS / $($failed.Count) FAIL / $total TOTAL" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "[BLOCKED] 以下规则未通过：" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "  [$($f.Rule)] $($f.Script)" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "修复后重新运行: powershell -File .qoder/scripts/check-stage3-gate.ps1" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host ""
    Write-Host "[PASS] Stage 3 门禁全部通过 — 可以进入开发" -ForegroundColor Green
    exit 0
}

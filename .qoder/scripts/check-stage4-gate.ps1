# ============================================================
# Stage 4 聚合门禁 — 集成验收前强制检查
# 调用所有 Stage 4 适用的规则检测脚本
# 用法: powershell -File .qoder/scripts/check-stage4-gate.ps1 [-TargetDir .]
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
Write-Host " Stage 4 Gate — 交付前强制门禁" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Stage 4 规则清单 (对应 gate-rules.yaml gates.stage4.rules)
Invoke-Check -ScriptName "check-api-endpoints.ps1" -RuleId "R014"
Invoke-Check -ScriptName "check-api-path-source.ps1" -RuleId "R012"
Invoke-Check -ScriptName "check-silent-catch.ps1" -RuleId "R015"
Invoke-Check -ScriptName "check-port-config.ps1" -RuleId "R011"
Invoke-Check -ScriptName "check-seed-single-source.ps1" -RuleId "R010"
Invoke-Check -ScriptName "check-e2e-browser-quota.ps1" -RuleId "R005"
# R001/R003/R006/R007/R008/R009/R013 暂不可脚本化，或需项目特定配置

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Stage 4 Gate 结果: $($passed.Count) PASS / $($failed.Count) FAIL / $total TOTAL" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "[BLOCKED] 以下规则未通过 — 禁止交付：" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "  [$($f.Rule)] $($f.Script)" -ForegroundColor Yellow
        if ($f.Output) {
            Write-Host "    $($f.Output)" -ForegroundColor DarkYellow
        }
    }
    Write-Host ""
    Write-Host "修复后重新运行: powershell -File .qoder/scripts/check-stage4-gate.ps1" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host ""
    Write-Host "[PASS] Stage 4 门禁全部通过 — 可以交付" -ForegroundColor Green
    exit 0
}

# ============================================================
# Stage 3 聚合门禁 — 开发前入口检查
# 调用所有 Stage 3 适用的规则检测脚本
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/check-stage3-gate.ps1 [-TargetDir .]
# ============================================================
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出：否则 PowerShell 5.1 按 GBK 码页输出中文，Agent 读到乱码

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = @()
$passed = @()
$skipped = @()
$total = 0

function Invoke-Check {
    param([string]$ScriptName, [string]$RuleId)

    $scriptPath = Join-Path $ScriptDir $ScriptName
    $script:total++
    if (-not (Test-Path $scriptPath)) {
        $script:failed += [PSCustomObject]@{ Rule = $RuleId; Script = $ScriptName; Error = "Script not found" }
        return
    }

    # 必须用 -Command：用 -File 时 "2>&1" 不会被 shell 解释，而是作为位置参数绑到子脚本的 [switch]$Json
    # （PowerShell 报"无法将 System.String 转换为 SwitchParameter"），导致该规则静默漏检。
    $result = & powershell -NoProfile -ExecutionPolicy Bypass -Command "& '$scriptPath' -TargetDir '$TargetDir' -Json 2>&1 | Out-String"
    $childRc = $LASTEXITCODE   # 必须立刻取：下面任何一次 cmdlet 调用都会刷新 $LASTEXITCODE
    $joined = ($result -join "`n")
    if ($childRc -ne 0) {
        $script:failed += [PSCustomObject]@{ Rule = $RuleId; Script = $ScriptName; Output = $joined }
        return
    }
    # rc=0 不等于"检查过了"：被检查脚本在无 spec / 无契约 / 无前端源码等情形下报 SKIP 并 exit 0。
    # 把它记进 PASS 就是 B022/B027 那个"虚假的绿"。
    if ($joined -match '"status"\s*:\s*"SKIP') {
        # 各脚本的 SKIP 载荷不一样：有的带 message，有的只带 checked=0，都翻译成可读原因
        $reason = if ($joined -match '"message"\s*:\s*"([^"]*)"') { $Matches[1] }
                  elseif ($joined -match '"checked"\s*:\s*0\b') { "待检查文件数为 0，检查未执行" }
                  else { "被检查脚本自报 SKIP" }
        $script:skipped += [PSCustomObject]@{ Rule = $RuleId; Script = $ScriptName; Reason = $reason }
    } else {
        $script:passed += $RuleId
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Stage 3 Gate — 开发前强制门禁" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Stage 3 规则清单 (对应 gate-rules.yaml gates.stage3.rules)
Invoke-Check -ScriptName "check-api-path-source.ps1" -RuleId "R012"
Invoke-Check -ScriptName "check-silent-catch.ps1" -RuleId "R015"
Invoke-Check -ScriptName "check-liquid-glass-style.ps1" -RuleId "R022-R026"
Invoke-Check -ScriptName "check-token-sync.ps1" -RuleId "R028"
Invoke-Check -ScriptName "check-skill-frontmatter.ps1" -RuleId "R029"
# R002/R004/R027 暂不可脚本化，由 Agent 自检
# R030/R031 由 starter 的 ESLint project-rules 承担（bun run lint），不在 PS 门禁重复实现

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Stage 3 Gate 结果: $($passed.Count) PASS / $($failed.Count) FAIL / $($skipped.Count) SKIP / $total TOTAL" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "[BLOCKED] 以下规则未通过：" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "  [$($f.Rule)] $($f.Script)" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "修复后重新运行: powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/check-stage3-gate.ps1" -ForegroundColor Yellow
    exit 1
} elseif ($skipped.Count -gt 0) {
    Write-Host ""
    Write-Host "[PASS*] Stage 3 无 FAIL，但下列规则**没有真正检查过**（跳过 ≠ 已验证，B022/B027）：" -ForegroundColor Magenta
    foreach ($s in $skipped) {
        Write-Host "  [$($s.Rule)] $($s.Script) — $($s.Reason)" -ForegroundColor DarkGray
    }
    Write-Host "  结论里必须原样带上这些跳过项，不能写成『门禁全绿』。" -ForegroundColor DarkGray
    exit 0
} else {
    Write-Host ""
    Write-Host "[PASS] Stage 3 门禁全部通过 — 可以进入开发" -ForegroundColor Green
    exit 0
}

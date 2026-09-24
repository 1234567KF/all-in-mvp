# Gate: R005 — E2E 浏览器交互配额 (v2.12)
# 检查 E2E spec 文件中 page.fill/click/goto 占比 ≥ 30%
param(
    [string]$TargetDir = ".",
    [decimal]$MinRatio = 0.30,
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出：否则 PowerShell 5.1 按 GBK 码页输出中文，Agent 读到乱码

$ErrorActionPreference = "Stop"
$violations = @()

$specFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "*.spec.ts","*.spec.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "e2e|spec" -and $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" }

if ($specFiles.Count -eq 0) {
    if ($Json) {
        Write-Output '{"status":"SKIP","rule":"R005","message":"no E2E spec files found"}'
    } else {
        Write-Host "[SKIP] R005 E2E 浏览器交互配额 — 未找到 E2E spec 文件" -ForegroundColor Gray
    }
    exit 0
}

foreach ($file in $specFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    # 统计浏览器交互行数
    $interactionLines = ([regex]::Matches($content, '(page\.(?:fill|click|goto|selectOption|check|uncheck|type|press|hover|drag|waitFor)|\bclick\s*\(|\bfill\s*\()', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
    $totalLines = ($content -split "`n" | Where-Object { $_ -match '\S' }).Count

    if ($totalLines -eq 0) { continue }

    $ratio = if ($totalLines -gt 0) { [math]::Round($interactionLines / $totalLines, 3) } else { 0 }

    if ($ratio -lt $MinRatio) {
        $violations += [PSCustomObject]@{
            File = $file.FullName
            InteractionLines = $interactionLines
            TotalLines = $totalLines
            Ratio = "$([math]::Round($ratio * 100, 1))%"
            Threshold = "$([math]::Round($MinRatio * 100, 0))%"
            Message = "浏览器交互占比 $([math]::Round($ratio * 100, 1))% < ${MinRatioPct}% 阈值"
        }
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R005`",`"files_checked`":$($specFiles.Count)}"
    } else {
        Write-Host "[PASS] R005 E2E 浏览器交互配额 — $($specFiles.Count) 个 spec 文件全部达标" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $violations | ConvertTo-Json -Compress   # 不能叫 $json：与 param [switch]$Json 同名（PS 变量名不区分大小写），赋值会触发 SwitchParameter 转换异常
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R005`",`"violations`":$($violations.Count),`"details`":$detailsJson}"
    } else {
        $MinRatioPct = [math]::Round($MinRatio * 100, 0)
        Write-Host "[FAIL] R005 E2E 浏览器交互配额 — $($violations.Count) 个文件不达标 (阈值: ${MinRatioPct}%)：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File) — 交互行$($_.InteractionLines)/总行$($_.TotalLines) = $($_.Ratio)" -ForegroundColor Yellow
        }
    }
    exit 1
}

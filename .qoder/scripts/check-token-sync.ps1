# Gate: R028 — 设计 token 镜像防漂移 (v2.20)
# 比对 .qoder/skills/references/liquid-glass/ 与权威脚手架 starters/liquid-glass-frontend/
# 任一文件内容不一致 → FAIL（禁止手工维护双份 token）
param(
    [Alias("TargetDir")]
    [string]$RepoRoot = "",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}

$scaffold = Join-Path $RepoRoot "starters/liquid-glass-frontend"
$mirror = Join-Path $RepoRoot ".qoder/skills/references/liquid-glass"

# 权威源 → 镜像 映射
$pairs = @(
    @{ Name = "theme-tokens.css"; Source = Join-Path $scaffold "apps/web/src/theme-tokens.css"; Mirror = Join-Path $mirror "theme-tokens.css" },
    @{ Name = "design-utils.css"; Source = Join-Path $scaffold "apps/web/src/design-utils.css"; Mirror = Join-Path $mirror "design-utils.css" },
    @{ Name = "index.css";        Source = Join-Path $scaffold "apps/web/src/index.css";        Mirror = Join-Path $mirror "index.css" },
    @{ Name = "DESIGN.md";        Source = Join-Path $scaffold "DESIGN.md";                    Mirror = Join-Path $mirror "DESIGN.md" }
)

function Read-Normalized([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    $text = Get-Content -Path $Path -Raw -ErrorAction SilentlyContinue
    if ($null -eq $text) { return "" }
    return ($text -replace "`r`n", "`n").TrimEnd()
}

$violations = @()
$checked = 0
$skipped = @()

foreach ($pair in $pairs) {
    if (-not (Test-Path $pair.Source)) {
        $skipped += $pair.Name
        continue
    }
    $checked++
    if (-not (Test-Path $pair.Mirror)) {
        $violations += [PSCustomObject]@{
            File = $pair.Mirror
            Rule = "R028"
            Message = "镜像文件缺失：$($pair.Name)（应从 $($pair.Source) 同步）"
        }
        continue
    }

    $src = Read-Normalized $pair.Source
    $dst = Read-Normalized $pair.Mirror
    if ($src -ne $dst) {
        # 找第一处差异行号
        $srcLines = $src -split "`n"
        $dstLines = $dst -split "`n"
        $max = [Math]::Max($srcLines.Count, $dstLines.Count)
        $firstDiff = 1
        for ($i = 0; $i -lt $max; $i++) {
            $a = if ($i -lt $srcLines.Count) { $srcLines[$i] } else { "<EOF>" }
            $b = if ($i -lt $dstLines.Count) { $dstLines[$i] } else { "<EOF>" }
            if ($a -ne $b) { $firstDiff = $i + 1; break }
        }
        $violations += [PSCustomObject]@{
            File = $pair.Mirror
            Rule = "R028"
            Message = "token 镜像已漂移：$($pair.Name) 首次差异在第 $firstDiff 行（权威源：$($pair.Source)）"
        }
    }
}

if ($violations.Count -eq 0) {
    # checked=0 表示权威脚手架不存在：规则未真正执行，状态报 SKIPPED 而不是 PASS
    $status = if ($checked -eq 0) { "SKIPPED" } else { "PASS" }
    if ($Json) {
        Write-Output "{`"status`":`"$status`",`"rule`":`"R028`",`"checked`":$checked,`"skipped`":$($skipped.Count)}"
    } else {
        Write-Host "[$status] R028 设计 token 镜像同步 — 已比对 $checked 个文件" -ForegroundColor $(if ($status -eq "PASS") { "Green" } else { "Yellow" })
        if ($skipped.Count -gt 0) {
            Write-Host "  (跳过 $($skipped.Count) 个：脚手架不存在 → $($skipped -join ', '))" -ForegroundColor DarkGray
        }
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $violations | ConvertTo-Json -Compress   # 不能叫 $json：与 param [switch]$Json 同名（PS 变量名不区分大小写），赋值会触发 SwitchParameter 转换异常
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R028`",`"violations`":$($violations.Count),`"details`":$detailsJson}"
    } else {
        Write-Host "[FAIL] R028 设计 token 镜像漂移 — $($violations.Count) 处：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File) — $($_.Message)" -ForegroundColor Yellow
        }
        Write-Host "  修复：从 starters/liquid-glass-frontend/ 重新复制，禁止手工改镜像" -ForegroundColor Cyan
    }
    exit 1
}

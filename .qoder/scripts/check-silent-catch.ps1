# Gate: R015 — 禁止静默吞错误 (v2.14)
# 扫描 .ts/.tsx 文件，检测 .catch(() => {}) 空回调反模式
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$violations = @()

Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" } |
    ForEach-Object {
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $content) { return }

        # 检测 .catch(() => {}) — 空箭头函数体
        if ($content -match '\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)') {
            $lineNum = 1
            $lines = $content -split "`n"
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)') {
                    $violations += [PSCustomObject]@{
                        File = $_.FullName
                        Line = $i + 1
                        Rule = "R015"
                        Message = ".catch(() => {}) 空回调反模式 — MUST 至少 console.warn(err) 或友好提示"
                    }
                }
            }
        }

        # 检测 .catch(() => { }) — 带空格
        if ($content -match '\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)' -and
            $content -match '\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s+\}\s*\)') {
            # already caught above pattern
        }
    }

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output '{"status":"PASS","rule":"R015","violations":0}'
    } else {
        Write-Host "[PASS] R015 禁止静默吞错误 — 未发现 .catch(() => {}) 空回调" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $json = $violations | ConvertTo-Json -Compress
        Write-Output "{\"status\":\"FAIL\",\"rule\":\"R015\",\"violations\":$($violations.Count),\"details\":$json}"
    } else {
        Write-Host "[FAIL] R015 禁止静默吞错误 — 发现 $($violations.Count) 处违规：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File):$($_.Line) — $($_.Message)" -ForegroundColor Yellow
        }
    }
    exit 1
}

# Gate: R010 — 种子数据单一真源 (v2.13)
# 检查 seeds/ 目录是否存在，Mock 和 DB seed 是否引用同一数据源
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$violations = @()

# 检查 seeds/ 目录是否存在
$seedsDir = Join-Path $TargetDir "seeds"
if (-not (Test-Path $seedsDir)) {
    if ($Json) {
        Write-Output '{"status":"FAIL","rule":"R010","message":"seeds/ directory not found"}'
    } else {
        Write-Host "[FAIL] R010 种子数据单一真源 — seeds/ 目录不存在" -ForegroundColor Red
        Write-Host "  MUST 创建独立 seeds/ 目录存放测试账号和基础数据" -ForegroundColor Yellow
    }
    exit 1
}

# 检查 seeds/ 中是否有账号定义文件
$seedFiles = Get-ChildItem -Path $seedsDir -Recurse -Include "*.ts","*.js","*.json","*.sql" -ErrorAction SilentlyContinue
$hasAccounts = $false
foreach ($f in $seedFiles) {
    $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "account|user|password|phone|role|seed") {
        $hasAccounts = $true
        break
    }
}

if (-not $hasAccounts) {
    $violations += [PSCustomObject]@{
        File = "seeds/"
        Message = "seeds/ 目录存在但未找到账号/基础数据定义文件"
    }
}

# 检查是否存在重复的账号定义（Mock vs DB）
$mockSeedFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts","*.js" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "mock" -and $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" } |
    Where-Object {
        $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        $c -match "accounts|users|TEST_ACCOUNTS|seedAccounts"
    }

$dbSeedFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts","*.js" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "db.*seed|seed.*db|database.*seed" -and $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" }

# 如果 Mock 和 DB 各自有独立的账号定义文件（且不在 seeds/ 下），标记警告
if ($mockSeedFiles.Count -gt 0 -and $dbSeedFiles.Count -gt 0) {
    $mockOutsideSeed = $mockSeedFiles | Where-Object { $_.FullName -notmatch "seeds[/\\]" }
    $dbOutsideSeed = $dbSeedFiles | Where-Object { $_.FullName -notmatch "seeds[/\\]" }
    if ($mockOutsideSeed -or $dbOutsideSeed) {
        $violations += [PSCustomObject]@{
            File = "multiple locations"
            Message = "Mock 和 DB 种子数据可能分散在多处 — MUST 统一从 seeds/ import"
        }
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output '{"status":"PASS","rule":"R010","seeds_dir":"present"}'
    } else {
        Write-Host "[PASS] R010 种子数据单一真源 — seeds/ 目录存在且有种子文件" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $json = $violations | ConvertTo-Json -Compress
        Write-Output "{\"status\":\"FAIL\",\"rule\":\"R010\",\"violations\":$($violations.Count),\"details\":$json}"
    } else {
        Write-Host "[FAIL] R010 种子数据单一真源 — $($violations.Count) 处违规：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File) — $($_.Message)" -ForegroundColor Yellow
        }
    }
    exit 1
}

# Gate: R012 — API 路径唯一真源 (v2.13)
# 验证前端 services/*.ts 的请求路径是否从 api-contract.yaml 提取
param(
    [string]$TargetDir = ".",
    [string]$ContractFile = "api-contract.yaml",
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$violations = @()

# 提取 contract 中所有路径
$contractPaths = @{}
$contractFile = Join-Path $TargetDir $ContractFile
if (Test-Path $contractFile) {
    $content = Get-Content $contractFile -Raw -ErrorAction SilentlyContinue
    $pathPattern = '^\s*(/\S+):\s*$'
    $matches = [regex]::Matches($content, $pathPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    foreach ($m in $matches) {
        $contractPaths[$m.Groups[1].Value] = $true
    }
}

if ($contractPaths.Count -eq 0) {
    Write-Host "[SKIP] R012 — api-contract.yaml 未找到或为空" -ForegroundColor Gray
    exit 0
}

# 扫描 services/ 目录下的 API 调用
$serviceFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "services[/\\]" -and $_.FullName -notmatch "node_modules|\.git|dist" }

if ($serviceFiles.Count -eq 0) {
    Write-Host "[SKIP] R012 — 未找到 services/ 目录" -ForegroundColor Gray
    exit 0
}

$pattern = "(?:api\.(?:get|post|put|delete|patch))\s*\(\s*['`"]([^'`"]+)['`"]"

foreach ($file in $serviceFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    $matches = [regex]::Matches($content, $pattern)
    foreach ($m in $matches) {
        $path = $m.Groups[1].Value
        if ($path -match ':\w+' -or $path -match '\$\{') { continue }
        if (-not $contractPaths.ContainsKey($path)) {
            $violations += [PSCustomObject]@{
                File = $file.FullName
                Path = $path
                Message = "services/ 中的路径 '$path' 不在 api-contract.yaml 中 — 可能按 Mock 约定编写而非 contract 提取"
            }
        }
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output '{"status":"PASS","rule":"R012","contract_paths":' + $contractPaths.Count + '}'
    } else {
        Write-Host "[PASS] R012 API 路径唯一真源 — services/ 所有路径均在 contract 中" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $json = $violations | ConvertTo-Json -Compress
        Write-Output "{\"status\":\"FAIL\",\"rule\":\"R012\",\"violations\":$($violations.Count),\"details\":$json}"
    } else {
        Write-Host "[FAIL] R012 API 路径唯一真源 — $($violations.Count) 处违规：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File)" -ForegroundColor Yellow
            Write-Host "    $($_.Path) — $($_.Message)" -ForegroundColor DarkYellow
        }
    }
    exit 1
}

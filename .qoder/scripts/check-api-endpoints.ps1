# Gate: R014/R016 — API 端点存在性交叉校验 (v2.14)
# 提取前端 api.get/post/put/delete/patch(url) → 与 contract + routes 交叉比对
param(
    [string]$TargetDir = ".",
    [string]$ContractFile = "api-contract.yaml",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出：否则 PowerShell 5.1 按 GBK 码页输出中文，Agent 读到乱码

$ErrorActionPreference = "Stop"
$violations = @()

# Step 1: 提取前端所有 API 调用路径
$apiCalls = @{}
$pattern = "(?:api\.(?:get|post|put|delete|patch))\s*\(\s*['`"]([^'`"]+)['`"]"

Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|\.qoder|\.ps1" } |
    ForEach-Object {
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $content) { return }

        $matches = [regex]::Matches($content, $pattern)
        foreach ($m in $matches) {
            $path = $m.Groups[1].Value
            if (-not $apiCalls.ContainsKey($path)) {
                $apiCalls[$path] = @()
            }
            $apiCalls[$path] += $_.FullName
        }
    }

if ($apiCalls.Count -eq 0) {
    if ($Json) {
        Write-Output '{"status":"SKIP","rule":"R014","message":"no api calls found"}'
    } else {
        Write-Host "[SKIP] R014 API 端点一致性 — 未发现前端 API 调用" -ForegroundColor Gray
    }
    exit 0
}

# Step 2: 提取 contract 中定义的路径
$contractPaths = @{}
if (Test-Path (Join-Path $TargetDir $ContractFile)) {
    $contractContent = Get-Content (Join-Path $TargetDir $ContractFile) -Raw -ErrorAction SilentlyContinue
    # 从 YAML 中提取路径 (以 / 开头的键)
    $pathPattern = '^\s*(/\S+):\s*$'
    $matches = [regex]::Matches($contractContent, $pathPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    foreach ($m in $matches) {
        $contractPaths[$m.Groups[1].Value] = $true
    }
}

# Step 3: 交叉比对 — 前端调用的路径在 contract 中不存在
foreach ($path in $apiCalls.Keys) {
    if (-not $contractPaths.ContainsKey($path)) {
        # 排除明显的动态路径（含 :param 模板语法）
        if ($path -match ':\w+' -or $path -match '\$\{') { continue }

        $violations += [PSCustomObject]@{
            Path = $path
            CalledFrom = ($apiCalls[$path] -join ", ")
            Rule = "R014"
            Message = "前端调用路径 '$path' 在 api-contract.yaml 中不存在 — 可能为 Agent 自行发明的端点"
        }
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R014`",`"endpoints_checked`":$($apiCalls.Count)}"
    } else {
        Write-Host "[PASS] R014 API 端点一致性 — $($apiCalls.Count) 个端点全部在 contract 中存在" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $violations | ConvertTo-Json -Compress   # 不能叫 $json：与 param [switch]$Json 同名（PS 变量名不区分大小写），赋值会触发 SwitchParameter 转换异常
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R014`",`"violations`":$($violations.Count),`"details`":$detailsJson}"
    } else {
        Write-Host "[FAIL] R014 API 端点一致性 — $($violations.Count) 个孤端点：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.Path)" -ForegroundColor Yellow
            Write-Host "    调用位置: $($_.CalledFrom)" -ForegroundColor DarkYellow
            Write-Host "    $($_.Message)" -ForegroundColor DarkYellow
        }
    }
    exit 1
}

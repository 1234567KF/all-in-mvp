# Gate: R011 — 端口配置化 (v2.13)
# 检测 .env / vite.config / playwright.config 中是否硬编码端口
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出：否则 PowerShell 5.1 按 GBK 码页输出中文，Agent 读到乱码

$ErrorActionPreference = "Stop"
$violations = @()
$hardcodedPorts = @("3333", "5555", "2222", "5173", "3000", "3001")

# 需要检查的配置文件
$configFiles = @(
    "vite.config.ts", "vite.config.js",
    "playwright.config.ts", "playwright.config.js",
    "playwright.real.config.ts",
    "src/api/config.ts", "api.config.ts",
    "src/env.ts", "src/config.ts"
)

foreach ($pattern in $configFiles) {
    $files = Get-ChildItem -Path $TargetDir -Recurse -Filter $pattern -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" }

    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $content) { continue }

        foreach ($port in $hardcodedPorts) {
            # 检查是否有 :PORT 字面量（非从 process.env 或 import.meta.env 读取）
            if ($content -match ":$port") {
                # 排除从环境变量读取的情况
                $lines = $content -split "`n"
                $lineNum = 1
                foreach ($line in $lines) {
                    if ($line -match ":$port" -and $line -notmatch "process\.env|import\.meta\.env|VITE_|API_PORT|WEB_PORT") {
                        $violations += [PSCustomObject]@{
                            File = $file.FullName
                            Line = $lineNum
                            Port = $port
                            Snippet = $line.Trim()
                            Message = "端口 $port 疑似硬编码 — MUST 从 .env 读取"
                        }
                    }
                    $lineNum++
                }
            }
        }
    }
}

# 检查 .env 文件是否存在
$envFile = Join-Path $TargetDir ".env"
$envExists = Test-Path $envFile

if (-not $envExists) {
    $violations += [PSCustomObject]@{
        File = ".env"
        Line = 0
        Port = "N/A"
        Snippet = ""
        Message = ".env 文件不存在 — 端口配置化强制要求 .env 定义 API_PORT/WEB_PORT"
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output '{"status":"PASS","rule":"R011","env_exists":true}'
    } else {
        Write-Host "[PASS] R011 端口配置化 — 未发现硬编码端口，.env 存在" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $violations | ConvertTo-Json -Compress   # 不能叫 $json：与 param [switch]$Json 同名（PS 变量名不区分大小写），赋值会触发 SwitchParameter 转换异常
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R011`",`"violations`":$($violations.Count),`"details`":$detailsJson}"
    } else {
        Write-Host "[FAIL] R011 端口配置化 — $($violations.Count) 处违规：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File):$($_.Line) — $($_.Message)" -ForegroundColor Yellow
            if ($_.Snippet) {
                Write-Host "    $($_.Snippet)" -ForegroundColor DarkYellow
            }
        }
    }
    exit 1
}

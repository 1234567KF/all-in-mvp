# Gate: R011 — 端口配置化 (v2.13 / v2.27 更正)
# 检测 .env / vite.config / playwright.config 中是否硬编码端口
#
# v2.27 两处更正（都是"门禁第一次对上权威 starter 就误报"，同 B026 教训）：
#   1) 权威 starter 把 `.env` 写进 .gitignore，提交的是 `.env.example` 模板 ——
#      原逻辑「`.env` 不存在即 FAIL」在新 clone 上必红，改成 .env / .env.example 二者有一即认可；
#   2) vite proxy 的 `target: "http://localhost:3000"` 是被设计固定的值（.env.example 里写明
#      "PORT=3000 固定，勿改"）。原逻辑一律判"硬编码"，但那不是漂移风险，是**声明值的字面引用**。
#      改为：命中值若在 env 文件里被声明过（PORT / API_PORT / WEB_PORT 任一），按"已声明例外"放行并计数。
#      真正的漂移（如 B009 的 5173→5177）仍然拦得住——那个值不会出现在声明里。
#   3) 原逻辑只扫 6 个写死的端口号（3333/5555/2222/5173/3000/3001）—— 换成任意端口字面量。
#      自检反例：把 vite.config 里的端口改成 5177（未在任何 env 声明），旧版照样 PASS，
#      正好放掉 B009 那一类漂移。同 B025/B027 的病根：门禁的覆盖面写死在检查器里，
#      而漂移发生在覆盖面之外。现在按「端口字面量」通用正则扫，env 声明值才是例外清单。
# 已声明盲区：值与声明同号但**语义不同**（例如 proxy 指 5173、恰好 WEB_PORT=5173）会被放行；
#            只扫配置文件清单内的文件名，清单外的自建配置不在范围；
#            非 URL 上下文里的 2–5 位数字若写成 `:1234` 形态会被当成端口（可接受：宁可误报）。
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出：否则 PowerShell 5.1 按 GBK 码页输出中文，Agent 读到乱码

$ErrorActionPreference = "Stop"
$violations = @()
# 端口字面量的两种出现形态：URL 里的 ://host:PORT，以及 port 键/赋值。
# 不再维护「已知端口清单」——清单外的端口恰恰是漂移的形态（见文件头 v2.27 第 3 条）。
$portLiteralPatterns = @(
    '(?:://[\w.\-]+|localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b',
    '\bport\s*[:=]\s*["'']?(\d{2,5})\b'
)
# 从环境变量取值 / 带 env 默认值的行不算硬编码。
# 注意：故意不排除 `${X}` 模板插值 —— 插值里没数字，端口正则本来就命中不了；
#       若一行同时出现硬编码端口和 ${path} 插值，那正是应该报的（B009 形态）。
$envReadPattern = 'process\.env|import\.meta\.env|Deno\.env|readEnv|loadEnv|VITE_|API_PORT|WEB_PORT'
$allowlistedCount = 0

# Step 0: 收集 env 文件里声明过的端口值（.env 优先，缺失时用 .env.example 模板）
$declaredPorts = @{}
$envSource = $null
foreach ($candidate in @(".env", ".env.example")) {
    $candidatePath = Join-Path $TargetDir $candidate
    if (Test-Path $candidatePath) {
        $envSource = $candidate
        $envRaw = Get-Content $candidatePath -Raw -ErrorAction SilentlyContinue
        if ($envRaw) {
            $envMatches = [regex]::Matches($envRaw, '(?m)^\s*(?:API_|WEB_)?PORT\s*=\s*(\d+)')
            foreach ($em in $envMatches) { $declaredPorts[$em.Groups[1].Value] = $true }
        }
        break
    }
}

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

        $lines = $content -split "`n"
        $lineNum = 1
        foreach ($line in $lines) {
            if ($line -notmatch $envReadPattern) {
                # 同一行可能被两条形态各命中一次，按「行 + 端口值」去重
                $seenOnLine = @{}
                foreach ($pattern in $portLiteralPatterns) {
                    foreach ($m in [regex]::Matches($line, $pattern)) {
                        $port = $m.Groups[1].Value
                        if ($seenOnLine.ContainsKey($port)) { continue }
                        $seenOnLine[$port] = $true
                        if ($declaredPorts.ContainsKey($port)) {
                            # 该值是 env 里显式声明过的固定端口 → 已声明例外，不报
                            $allowlistedCount++
                        } else {
                            $violations += [PSCustomObject]@{
                                File = $file.FullName
                                Line = $lineNum
                                Port = $port
                                Snippet = $line.Trim()
                                Message = "端口 $port 硬编码且未在 env 中声明 — MUST 从 .env / .env.example 读取"
                            }
                        }
                    }
                }
            }
            $lineNum++
        }
    }
}

# 检查 env 文件是否存在（.env 被 gitignore 是常规做法，有 .env.example 模板即可）
if (-not $envSource) {
    $violations += [PSCustomObject]@{
        File = ".env / .env.example"
        Line = 0
        Port = "N/A"
        Snippet = ""
        Message = "既没有 .env 也没有 .env.example — 端口配置化要求至少提交 env 模板并定义 API_PORT/WEB_PORT"
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R011`",`"env_source`":`"$envSource`",`"allowlisted`":$allowlistedCount}"
    } else {
        Write-Host "[PASS] R011 端口配置化 — 未发现未声明的硬编码端口（env 来源: $envSource，已声明例外 $allowlistedCount 处）" -ForegroundColor Green
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

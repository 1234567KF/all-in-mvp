# Gate: R014/R016 — API 端点存在性交叉校验 (v2.14, v2.26 加真实后端路由比对)
# 提取前端 api.get/post/put/delete/patch(url) → 与「后端真实注册路由」+ contract 交叉比对
# v2.26：真相源从 api-contract.yaml 变成后端代码本身。派生视图（契约文件）与代码漂移时，
#        只要后端确实注册了该路由就不再判违规；两边都没有才是孤端点。
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

        # 禁用 $matches：它是 -match 运算符会覆写的自动变量（大小写不敏感）
        $regexMatches = [regex]::Matches($content, $pattern)
        foreach ($m in $regexMatches) {
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
    $regexMatches = [regex]::Matches($contractContent, $pathPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    foreach ($m in $regexMatches) {
        $contractPaths[$m.Groups[1].Value] = $true
    }
}

# Step 2b: 提取后端真实注册路由（Hono 风格：ident.route("/prefix", subIdent) + subIdent.get("/path")）
#   两遍扫描：先收全部挂载前缀（挂载可能出现在别的文件、时间上晚于 handler），再收 handler。
#   已声明盲区：三层以上嵌套挂载、Express app.use('/x', router) 之外的注册形式、
#               变量名同名不同实例（如两个文件里都叫 router）会被合并。
$mountByVar = @{}          # 变量名 -> 前缀列表（总含 ""：被挂载的实例自身通常也直接服务请求）
$routeTemplates = @()
$mountPattern = [regex]'(\w+)\.route\(\s*["'']([^"'']*)["'']\s*,\s*(\w+)\s*\)'
$handlerPattern = [regex]'(\w+)\.(get|post|put|delete|patch|all)\(\s*["'']([^"'']*)["'']'

$backendFiles = @(Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|\.qoder" -and
                   $_.Name -notmatch '\.test\.ts$' -and
                   $_.FullName -match "(?i)apps[\\/](api|server)[\\/]|[\\/]src[\\/]index\.ts$" })

$backendContents = @()
foreach ($f in $backendFiles) {
    $c = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $c) { continue }
    $backendContents += [PSCustomObject]@{ Path = $f.FullName; Content = $c }
}

function Add-Prefix([string]$var, [string]$prefix) {
    if (-not $script:mountByVar.ContainsKey($var)) { $script:mountByVar[$var] = @("") }
    if ($script:mountByVar[$var] -notcontains $prefix) { $script:mountByVar[$var] += $prefix }
}

foreach ($item in $backendContents) {
    foreach ($m in $mountPattern.Matches($item.Content)) {
        $parent = $m.Groups[1].Value; $prefix = $m.Groups[2].Value; $child = $m.Groups[3].Value
        Add-Prefix $child ""
        Add-Prefix $parent ""
        foreach ($pp in @($script:mountByVar[$parent])) { Add-Prefix $child ($pp + $prefix) }
    }
}

foreach ($item in $backendContents) {
    foreach ($m in $handlerPattern.Matches($item.Content)) {
        $var = $m.Groups[1].Value; $sub = $m.Groups[3].Value
        $prefixes = @("")
        if ($mountByVar.ContainsKey($var)) { $prefixes = $mountByVar[$var] }
        foreach ($p in $prefixes) {
            $full = ($p + $sub) -replace '/{2,}', '/'
            # Hono 会把尾斜杠折叠：route("/notifications") + .get("/") 实际匹配 /notifications
            if ($full.Length -gt 1 -and $full.EndsWith("/")) { $full = $full.TrimEnd("/") }
            if (-not $full) { $full = "/" }
            $routeTemplates += $full
        }
    }
}

# 把路由模板编译成正则（:param -> 单段通配）
$routeRegexes = @()
foreach ($tpl in ($routeTemplates | Sort-Object -Unique)) {
    if (-not $tpl) { continue }
    $escaped = [regex]::Escape($tpl) -replace '\\:[A-Za-z0-9_]+', '[^/]+'
    $routeRegexes += [regex]("^" + $escaped + "$")
}

function Test-BackendRoute([string]$path) {
    foreach ($rx in $routeRegexes) { if ($rx.IsMatch($path)) { return $true } }
    return $false
}

# Step 3: 交叉比对 — 前端调用的路径在 contract 与后端路由中都不存在
foreach ($path in $apiCalls.Keys) {
    # 排除明显的动态路径（含 :param 模板语法）
    if ($path -match ':\w+' -or $path -match '\$\{' -or $path -match '^https?://') { continue }

    $candidates = @($path)
    if ($path -match '^/api(/.*)$') { $candidates += $Matches[1] }   # dev 代理会剥掉一层 /api

    $inContract = $contractPaths.ContainsKey($path)
    $inBackend = $false
    foreach ($cand in $candidates) { if (Test-BackendRoute $cand) { $inBackend = $true; break } }

    if (-not $inContract -and -not $inBackend) {
        $violations += [PSCustomObject]@{
            Path = $path
            CalledFrom = ($apiCalls[$path] -join ", ")
            Rule = "R014"
            Message = "前端调用路径 '$path' 后端未注册、契约里也没有 — 孤端点（真实运行必 404）"
        }
    }
}

$degraded = ($routeRegexes.Count -eq 0)

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R014`",`"endpoints_checked`":$($apiCalls.Count),`"backend_routes_discovered`":$($routeRegexes.Count),`"degraded`":$(if ($degraded) { 'true' } else { 'false' })}"
    } else {
        Write-Host "[PASS] R014 API 端点一致性 — $($apiCalls.Count) 个端点全部命中后端路由或契约（后端路由发现 $($routeRegexes.Count) 条）" -ForegroundColor Green
    }
    if ($degraded) {
        # 覆盖面降级必须显式说出来：只看 contract 时，"后端有没有这条路由"根本没被检查过
        Write-Host "[WARN] 未发现任何后端路由（0 条）— 本轮仅按契约校验，孤端点检出能力降级；请确认 -TargetDir 覆盖到 apps/api" -ForegroundColor Yellow
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $violations | ConvertTo-Json -Compress   # 不能叫 $json：与 param [switch]$Json 同名（PS 变量名不区分大小写），赋值会触发 SwitchParameter 转换异常
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R014`",`"violations`":$($violations.Count),`"backend_routes_discovered`":$($routeRegexes.Count),`"degraded`":$(if ($degraded) { 'true' } else { 'false' }),`"details`":$detailsJson}"
    } else {
        Write-Host "[FAIL] R014 API 端点一致性 — $($violations.Count) 个孤端点（后端路由发现 $($routeRegexes.Count) 条）：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.Path)" -ForegroundColor Yellow
            Write-Host "    调用位置: $($_.CalledFrom)" -ForegroundColor DarkYellow
            Write-Host "    $($_.Message)" -ForegroundColor DarkYellow
        }
    }
    exit 1
}

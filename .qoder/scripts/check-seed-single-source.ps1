# Gate: R010 — 种子数据单一真源 (v2.13 / v2.27 更正)
# 检查：账号/基础数据的定义是否只有一处真源，派生启动脚本是否由生成器产出
#
# v2.27 三处更正（同 B026/B027 病根：把「我们项目的目录形状」当成规则本身）：
#   1) 原逻辑硬要求根目录 seeds/ —— 权威 starter 是 monorepo，种子在 apps/api/scripts/seed-dev.ts。
#      目录约定不同 ≠ 没有单源，改为「按定义形状定位种子源」，根 seeds/ 只是候选之一。
#   2) 原逻辑专门查 Mock vs DB 分散 —— v2.26 去前后端分离后 Mock 层已不存在，那条检查恒不命中（空门禁）。
#      改成通用形态：任何「非种子文件里定义账号记录」都算分散，Mock 只是其中一例。
#   3) 新增派生一致性：init.sql 这类由 schema/seed 生成的启动脚本 MUST 有生成器，禁手写维护
#      （否则种子改了库不跟着改 —— 正是 B028「测试环境与验收环境不是同一套数据」的机制）。
# 实测标定（权威 starter 0005fa1）：1 真阳 —— apps/api/src/db.ts 在结构自举时 inline
#   `db.insert(users).values({ email: "admin", role: "admin" })`，与 apps/api/scripts/seed-dev.ts
#   的 admin 行构成两套定义（种子改了，自举不会跟着改 —— B028 同类机制）。框架侧只报不修。
# 已声明盲区：① 账号由 DB 查询/变量拼接得到时识别不到；② 文件名含 test/spec 的 fixture 放行
#   （测试自建数据允许），但生产代码里的凭证字面量不放行；③ scripts/ 下的代码生成器（含 writeFileSync）
#   里的凭证是「写进产物的模板」，按模板放行不拦（实测 gen-module.ts 生成的测试 JWT payload）；
#   ④ 标识符字面量限定 ASCII 形态，因此用中文/变量名做账号键的写法识别不到。
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 保证 UTF-8 输出：否则 PowerShell 5.1 按 GBK 码页输出中文，Agent 读到乱码

$ErrorActionPreference = "Stop"
$violations = @()

# 账号记录的定义形状：标识符字面量 + 凭证/角色字面量 同时出现。
# 标识符值限定 ASCII（邮箱/用户名形态）—— 否则 i18n 字段标签 `email: "邮箱"` 会被当成账号定义（实测误报）。
$identPattern = '(?:email|username|user_?name|login|account)\s*[:=]\s*["'']([A-Za-z0-9._%+-@:]{3,})["'']'
$credPattern  = '(?:password|passwd|salt|role|permissions)\s*[:=]\s*["'']'
# 账号行落库插入：insert(users) 附近 4 行内出现字面量 values（种子文件之外的这种插入 = 第二套账号定义）
$insertPattern = '\.(?:insert|upsert)\(\s*users\b'
$valuesPattern = '\.values\s*\([^)]*["''][A-Za-z0-9._%+-@:]{3,}["'']'

# 种子源的路径形状（根 seeds/ 是其中一种，不是唯一一种）
$seedPathPattern = '(^|[\\/])seeds?[\\/]|(^|[\\/])[^\\/]*seed[^\\/]*$|demo-seed|seed-dev|fixtures?[\\/]'

$scanFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "*.ts","*.tsx","*.js","*.jsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|[\\/]\.git[\\/]|[\\/]dist[\\/]|[\\/]\.qoder[\\/]" } |
    Where-Object { $_.Name -notmatch "\.test\.|\.spec\.|test-helpers|vitest|playwright" } |
    Where-Object { $_.FullName -notmatch "[\\/]tests?[\\/]" }

$rootFull = (Resolve-Path $TargetDir).Path
$seedSources = @()
$foreignDefs = @()

foreach ($file in $scanFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    $rel = $file.FullName.Substring($rootFull.Length + 1) -replace "\\", "/"
    $isSeed = $rel -match $seedPathPattern

    # 代码生成器（脚手架）里的账号字面量是「写进产物的模板」，不是本仓的定义点：
    # 实测命中 scripts/gen-module.ts 生成的测试 JWT payload 模板。模板本身仍需被审，但不由 R010 拦。
    $isEmitter = ($content -match 'writeFileSync|Bun\.write|writeTextFile|fs\.write') -and ($rel -match '(^|[\\/])scripts[\\/]')

    if ($isSeed -and $content -match $identPattern -and $content -match $credPattern) {
        $seedSources += [PSCustomObject]@{ Path = $rel; Content = $content }
    }

    if (-not $isSeed -and -not $isEmitter) {
        $isForeign = $false
        if ($content -match $identPattern -and $content -match $credPattern) { $isForeign = $true }
        if (-not $isForeign) {
            $lines = $content -split "`n"
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -notmatch $insertPattern) { continue }
                $window = ($lines[$i..([Math]::Min($i + 4, $lines.Count - 1))] -join " ")
                if ($window -match $valuesPattern) { $isForeign = $true; break }
            }
        }
        if ($isForeign) {
            $snippet = ($content -split "`n" | Where-Object { $_ -match $identPattern -or $_ -match $insertPattern } | Select-Object -First 1)
            $foreignDefs += [PSCustomObject]@{
                File    = $rel
                Snippet = ($snippet -replace '^\s+', '')
            }
        }
    }
}

# 1) 没有任何种子源：双分支走查无法造数（v2.26 起 R035 的前置条件）
if ($seedSources.Count -eq 0) {
    $violations += [PSCustomObject]@{
        File    = "seeds / *seed*.ts"
        Message = "未找到种子定义文件 — 种子数据必须有一处真源（异常分支造数依赖它），且需可重复播种"
    }
}

# 2) 种子定义散落在非种子文件里（原「Mock vs DB 分散」的通用版）
foreach ($d in ($foreignDefs | Sort-Object -Property File -Unique)) {
    $violations += [PSCustomObject]@{
        File    = $d.File
        Snippet = $d.Snippet
        Message = "账号记录在非种子文件中定义/落库 — MUST 收敛到种子真源后 import，禁止各写一套"
    }
}

# 3) 多个种子源之间必须存在 import 关系，否则是两套并行定义
if ($seedSources.Count -gt 1) {
    $linked = $false
    foreach ($a in $seedSources) {
        foreach ($b in $seedSources) {
            if ($a.Path -eq $b.Path) { continue }
            $base = [IO.Path]::GetFileNameWithoutExtension($b.Path)
            # 不能写成 "$base[...]"：PS 在可展开字符串里把 $name[...] 解析成下标
            $importPat = 'from\s+["''][^"'']*' + [regex]::Escape($base) + '["'']'
            if ($a.Content -match 'import[\s\S]{0,400}' -and $a.Content -match $importPat) { $linked = $true; break }
        }
        if ($linked) { break }
    }
    if (-not $linked) {
        $paths = ($seedSources | ForEach-Object { $_.Path }) -join ", "
        $violations += [PSCustomObject]@{
            File    = "multiple locations"
            Message = "种子源有 $($seedSources.Count) 处且互相不 import（$paths）— MUST 一处定义、多处引用"
        }
    }
}

# 4) 派生启动脚本（init.sql / seed*.sql）MUST 由生成器产出
$sqlFiles = Get-ChildItem -Path $TargetDir -Recurse -Include "*.sql" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|[\\/]\.git[\\/]|[\\/]dist[\\/]|[\\/]\.qoder[\\/]" } |
    Where-Object { $_.Name -match "^(init|bootstrap|seed|schema)" }

foreach ($sql in $sqlFiles) {
    $sqlName = $sql.Name
    $appDir = $sql.DirectoryName
    $generators = Get-ChildItem -Path $appDir -Recurse -Include "*.ts","*.js" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "node_modules|[\\/]dist[\\/]" } |
        Where-Object {
            $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
            $c -and $c -match [regex]::Escape($sqlName) -and $_.Name -match "gen|generate|write|dump"
        }
    if (-not $generators) {
        $violations += [PSCustomObject]@{
            File    = $sqlName
            Message = "初始化脚本 $sqlName 找不到生成器（gen/generate 且引用该文件名）— 手写 SQL 会与 schema/种子漂移"
        }
    }
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R010`",`"seed_sources`":$($seedSources.Count),`"derived_sql`":$($sqlFiles.Count)}"
    } else {
        $list = ($seedSources | ForEach-Object { $_.Path }) -join ", "
        Write-Host "[PASS] R010 种子数据单一真源 — 种子源: $list（派生脚本 $($sqlFiles.Count) 个均有生成器）" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $violations | ConvertTo-Json -Compress   # 不能叫 $json：与 param [switch]$Json 同名（PS 变量名不区分大小写），赋值会触发 SwitchParameter 转换异常
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R010`",`"violations`":$($violations.Count),`"details`":$detailsJson}"
    } else {
        Write-Host "[FAIL] R010 种子数据单一真源 — $($violations.Count) 处违规：" -ForegroundColor Red
        $violations | ForEach-Object {
            Write-Host "  $($_.File) — $($_.Message)" -ForegroundColor Yellow
        }
    }
    exit 1
}

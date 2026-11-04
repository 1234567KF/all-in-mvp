# Gate: R029 — 技能/Agent frontmatter 严格 YAML 校验 (v2.25)
# 背景：Qoder 的 App 侧技能列表用严格 YAML 解析 frontmatter；解析失败时该技能在 UI 里
#       静默消失，而 Agent 侧加载器仍可能激活它 —— 即"看起来在，实际没注册"（血案 B024）。
#       典型触发：description 是 plain scalar 却内含 ": "（如 "Triggers: MVP, ... NOT for: ..."），
#       YAML 报 "mapping values are not allowed here"，整块 frontmatter 作废。
# 语义：只做结构性扫描（不引入 YAML 依赖），命中的都是"必然解析失败/必然截断"的形态。
# 盲区：见 gate-rules.yaml R029 的 description —— 本脚本是行级近似，不是完整 YAML 解析器。
param(
    [Alias("TargetDir")]
    [string]$RepoRoot = "",
    [switch]$IncludeHomes,
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # PS 5.1 默认 GBK 码页，中文会乱码
$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}

function Get-FmFiles([string]$Root) {
    $pat = @(
        (Join-Path $Root ".qoder/skills/*/SKILL.md"),
        (Join-Path $Root ".qoder/agents/*.md"),
        (Join-Path $Root "starters/*/.agents/skills/*/SKILL.md")
    )
    $all = @()
    foreach ($p in $pat) { $all += @(Get-ChildItem -Path $p -File -ErrorAction SilentlyContinue) }
    return $all
}

$roots = @($RepoRoot)
if ($IncludeHomes) {
    # 同步产物同样会被手工编辑（home 里改一版测试 → 忘了改回仓库），故可显式纳入检查
    foreach ($h in @(".qoder-cn", ".qoder")) {
        $full = Join-Path $env:USERPROFILE $h
        if (Test-Path $full) { $roots += $full }
    }
}

$files = @()
foreach ($r in $roots) { $files += @(Get-FmFiles $r) }

# --- 单文件扫描 -------------------------------------------------------------
function Scan-Frontmatter([string]$Path) {
    $issues = @()
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $issues += "存在 UTF-8 BOM：部分加载器会把 BOM 当作首键名的一部分，导致 name 解析为空"
    }
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF) { $text = $text.Substring(1) }
    $text = $text -replace "`r`n", "`n"

    if (-not $text.StartsWith("---")) {
        $issues += "缺少 frontmatter（首个非空内容必须是 --- 起始行）"
        return @{ Issues = $issues; HasFm = $false }
    }
    $lines = $text -split "`n"
    $close = -1
    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^(-{3,}|\.{3})\s*$') { $close = $i; break }
    }
    if ($close -lt 0) {
        $issues += "frontmatter 未闭合（缺少结束的 --- 行），正文会被当进 YAML"
        return @{ Issues = $issues; HasFm = $false }
    }

    $keys = @{}
    $inBlock = $false
    $blockIndent = 0
    for ($i = 1; $i -lt $close; $i++) {
        $line = $lines[$i]
        $ln = $i + 1

        if ($line -match "^\s*$" -or $line -match "^\s*#") { continue }
        if ($line -match "`t") { $issues += "第 $ln 行用 Tab 缩进（YAML 禁止 Tab 表示缩进）：$($line.Trim())" }

        if ($inBlock) {
            $ind = ($line -replace "^( ).*", '$1').Length
            if ($ind -le $blockIndent) { $inBlock = $false } else { continue }  # 块标量内容不解析
        }

        # 块标量起始：key: | / key: > / key: >- / key: |+
        if ($line -match '^(?<ind>\s*)(?<k>[A-Za-z0-9_.\-]+):\s*(?<mod>[|>][-+0-9]*)\s*(#.*)?$') {
            $blockIndent = $matches['ind'].Length
            $inBlock = $true
            $keys[$matches['k']] = "block"
            continue
        }

        # 序列项：值由 YAML 自行判定，行级检查只看保留指示符
        if ($line -match '^\s*-\s*(?<v>.*)$') {
            $v = $matches['v'].Trim()
            if ($v -ne "" -and $v[0] -in @('@', '`')) {
                $issues += "第 $ln 行序列项以保留指示符 '$($v[0])' 开头，需加引号：$v"
            }
            continue
        }

        if ($line -match '^(?<ind>\s*)(?<k>[A-Za-z0-9_.\-][^:]*?):\s*(?<v>.*?)\s*$') {
            $k = $matches['k'].Trim()
            $v = $matches['v']
            if ($k -match '\s') { $issues += "第 $ln 行键名含空格：'$k'" }
            $keys[$k] = $v
            if ($v -eq "" -or $v.StartsWith("#")) { continue }        # 父级键 / 纯注释

            if ($v[0] -eq '[' -or $v[0] -eq '{') {                    # flow 集合：只看闭合
                $open = @{ '[' = ']'; '{' = '}' }[$v[0]]
                if (-not $v.EndsWith($open)) {
                    $issues += "第 $ln 行 flow 集合未闭合（缺 $open）：$v"
                }
                continue
            }
            if ($v[0] -eq '"' -or $v[0] -eq "'") {                    # 引号标量：必须闭合
                $q = $v[0]
                $body = ($v -replace '\s+#.*$', '').TrimEnd()          # 先去掉合法的行尾注释
                if (-not $body.EndsWith($q) -or $body.Length -lt 2) {
                    $issues += "第 $ln 行引号标量未闭合（缺 $q）：$v"
                }
                continue
            }

            # plain scalar：以下形态会让严格解析器整块失败或静默截断
            if ($v -match ':($|\s)' -and $v -notmatch '^\s*[|>]') {
                $issues += "第 $ln 行 plain scalar 内含冒号+空格（YAML 视作映射 → 'mapping values are not allowed here'）：$v"
            }
            if ($v -match ' #') {
                $issues += "第 $ln 行值内出现 空格+井号，会被当行内注释静默截断（要字面量请加引号）：$v"
            }
            if ($v[0] -in @('@', '`', '*', '&', '%')) {
                $issues += "第 $ln 行 plain scalar 以保留指示符 '$($v[0])' 开头，需加引号：$v"
            }
            continue
        }

        $issues += "第 $ln 行无法识别为 YAML 键值对（缩进或拼写异常）：$($line.Trim())"
    }

    foreach ($req in @('name', 'description')) {
        if (-not $keys.ContainsKey($req)) { $issues += "缺少必填字段 '$req'" ; continue }
        if ($keys[$req] -eq "") { $issues += "必填字段 '$req' 为空" }
    }
    return @{ Issues = $issues; HasFm = $true }
}

# --- 汇总 -------------------------------------------------------------------
$violations = @()
$checked = 0
foreach ($f in $files) {
    $checked++
    $r = Scan-Frontmatter $f.FullName
    foreach ($iss in $r.Issues) {
        $violations += [PSCustomObject]@{ File = $f.FullName; Rule = "R029"; Message = $iss }
    }
}

if ($checked -eq 0) {
    # 找不到任何技能/Agent 文件 = 检查根本没跑，必须报 SKIPPED 而不是 PASS
    if ($Json) { Write-Output "{`"status`":`"SKIPPED`",`"rule`":`"R029`",`"checked`":0}" }
    else { Write-Host "[SKIPPED] R029 — 未找到待检查的 SKILL.md / agent frontmatter（检查未执行）" -ForegroundColor Yellow }
    exit 0
}

if ($violations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R029`",`"checked`":$checked}"
    } else {
        Write-Host "[PASS] R029 frontmatter 严格 YAML 校验 — 已检查 $checked 个文件" -ForegroundColor Green
    }
    exit 0
}

$hint = "修复：把含 ': ' 的字段改成块标量（description: >- 换行缩进写内容）或整体加引号；改完用严格解析器复核（powershell 本脚本 或 uv run --with pyyaml python -c 'import yaml,io;yaml.safe_load(...)'）"
if ($Json) {
    # 不能命名为 $json：与 [switch]$Json 同名（PS 变量名不区分大小写）
    $detailsJson = $violations | ConvertTo-Json -Compress
    Write-Output "{`"status`":`"FAIL`",`"rule`":`"R029`",`"checked`":$checked,`"violations`":$($violations.Count),`"details`":$detailsJson}"
} else {
    Write-Host "[FAIL] R029 frontmatter YAML 校验未通过 — $($violations.Count) 处：" -ForegroundColor Red
    $violations | ForEach-Object { Write-Host "  $($_.File)`n    $($_.Message)" -ForegroundColor Yellow }
    Write-Host "  $hint" -ForegroundColor Cyan
    Write-Host "  影响：解析失败的技能在 App 技能列表中静默消失（Agent 侧仍可能激活），排障时看不出缺了什么。" -ForegroundColor DarkYellow
}
exit 1

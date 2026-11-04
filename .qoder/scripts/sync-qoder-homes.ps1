# ============================================================
# sync-qoder-homes.ps1 — 把仓库 HEAD 的 all-in-mvp 资产同步到 Qoder 用户级 home
# 背景：本机存在两个 Qoder home —— 桌面/CLI 版用 ~/.qoder-cn，IDE 版用 ~/.qoder。
#       全局调用要求 <home>/skills 与 <home>/agents 有技能与子 Agent；
#       工作区门禁由 <home>/frameworks/all-in-mvp + bootstrap 提供。
#       仓库改完不同步 → 全局调用读到旧版（本次 kf-skill-design-expert 文案残留就是这种情况）。
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File .qoder\scripts\sync-qoder-homes.ps1
#   ... -InstallGlobalHooks        # 另外把 hooks 合并进 <home>/settings.json（绝对路径命令，需重启生效）
#   ... -Homes ".qoder-cn" -Json
# 语义：只新增/覆盖，不删除 home 里的其他技能（home 可能装着与本项目无关的技能）。
# ============================================================
param(
    [string]$RepoRoot = "",
    [string[]]$Homes = @(".qoder-cn", ".qoder"),
    [switch]$InstallGlobalHooks,
    [switch]$Force,
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # PS 5.1 默认 GBK 码页，中文会乱码
$ErrorActionPreference = "Stop"   # 同步失败必须显式非零退出，禁止"看起来成功了"

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$qoderSrc = Join-Path $RepoRoot ".qoder"
if (-not (Test-Path (Join-Path $qoderSrc "skills\all-in-mvp\SKILL.md"))) {
    Write-Host "[FAIL] 源目录不含 all-in-mvp 技能：$qoderSrc" -ForegroundColor Red
    exit 1
}

# 只处理真实存在的 home；不存在的跳过（而不是静默当成成功）
$targets = @()
$absent = @()
foreach ($h in $Homes) {
    $full = Join-Path $env:USERPROFILE $h
    if (Test-Path $full) { $targets += $full } else { $absent += $h }
}
if ($targets.Count -eq 0) {
    Write-Host "[FAIL] 未找到任何 Qoder home（查找：$($Homes -join ', ')）" -ForegroundColor Red
    exit 1
}

function Test-SkipPath {
    param([string]$Full)
    $p = ($Full -replace '\\', '/')
    # 依赖与构建产物不入全局目录：体积大，且 .vite-temp 这类瞬时文件会在复制中途消失（实测会让复制抛异常）
    return ($p -match '(^|/)(node_modules|dist|build|coverage|playwright-report|\.vite|\.vite-temp|\.turbo|\.next|\.cache|test-results)(/|$)')
}

function Copy-Tree {
    param([string]$Source, [string]$Destination, [string]$Filter = "*", [bool]$Recurse = $true)
    if (-not (Test-Path $Source)) { return 0 }
    $n = 0
    foreach ($fi in (Get-ChildItem -Path $Source -Filter $Filter -Recurse:$Recurse -File -ErrorAction SilentlyContinue)) {
        if (Test-SkipPath $fi.FullName) { continue }
        $rel = $fi.FullName.Substring($Source.Length).TrimStart('\', '/')
        $dst = Join-Path $Destination $rel
        $parent = Split-Path -Parent $dst
        if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        [System.IO.File]::Copy($fi.FullName, $dst, $true)
        $n++
    }
    return $n
}

function Get-TreeHash {
    param([string]$Path, [bool]$Recurse = $true)
    if (-not (Test-Path $Path)) { return @{} }
    $map = @{}
    foreach ($fi in (Get-ChildItem -Path $Path -File -Recurse:$Recurse -ErrorAction SilentlyContinue)) {
        if (Test-SkipPath $fi.FullName) { continue }
        $rel = ($fi.FullName.Substring($Path.Length).TrimStart('\', '/') -replace '\\', '/').ToLower()
        $map[$rel] = (Get-FileHash -Path $fi.FullName -Algorithm SHA256).Hash
    }
    return $map
}

function Compare-Tree {
    param([string]$Source, [string]$Destination, [bool]$Recurse = $true)
    $srcMap = Get-TreeHash $Source $Recurse
    $dstMap = Get-TreeHash $Destination $Recurse
    $drift = @()
    foreach ($k in $srcMap.Keys) {
        if (-not $dstMap.ContainsKey($k)) { $drift += "$k (home 缺失)" }
        elseif ($dstMap[$k] -ne $srcMap[$k]) { $drift += "$k (内容不一致)" }
    }
    return $drift
}

$rows = @()
foreach ($homeDir in $targets) {   # 不能叫 $home：PowerShell 的 $HOME 是只读自动变量，赋值会抛 VariableNotWritable
    $fw = Join-Path $homeDir "frameworks\all-in-mvp"
    $counts = [ordered]@{
        skills     = Copy-Tree -Source (Join-Path $qoderSrc "skills") -Destination (Join-Path $homeDir "skills")
        agents     = Copy-Tree -Source (Join-Path $qoderSrc "agents") -Destination (Join-Path $homeDir "agents")
        scripts    = Copy-Tree -Source (Join-Path $qoderSrc "scripts") -Destination (Join-Path $homeDir "scripts") -Filter "*.ps1" -Recurse $false
        frameworks = Copy-Tree -Source $qoderSrc -Destination $fw
        starters   = Copy-Tree -Source (Join-Path $RepoRoot "starters") -Destination (Join-Path $fw "starters")
    }

    # 同步后逐树校验：home 内容与仓库 HEAD 是否逐字节一致
    $drift = @()
    $drift += Compare-Tree (Join-Path $qoderSrc "skills") (Join-Path $homeDir "skills")
    $drift += Compare-Tree (Join-Path $qoderSrc "agents") (Join-Path $homeDir "agents")
    $drift += Compare-Tree (Join-Path $qoderSrc "scripts") (Join-Path $homeDir "scripts")

    # hooks 模板在工作区里叫 settings.json；框架镜像统一提供 settings.hooks.json 供 bootstrap 取用
    $hooksTpl = Join-Path $qoderSrc "settings.hooks.json"
    if (Test-Path $hooksTpl) {
        [System.IO.File]::Copy($hooksTpl, (Join-Path $fw "settings.hooks.json"), $true) | Out-Null
    }

    $hookNote = "未请求"
    if ($InstallGlobalHooks) {
        $hookScript = Join-Path $homeDir "scripts\quality-gate-hook.ps1"
        $settingsPath = Join-Path $homeDir "settings.json"
        $hookObj = @{
            PostToolUse = @(
                @{
                    matcher = "Write|Edit|MultiEdit"
                    hooks   = @(
                        @{
                            type    = "command"
                            # 绝对路径：用户级 hooks 在任何工作区都执行，相对路径只会命中 cwd
                            command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$hookScript`""
                            timeout = 20
                        }
                    )
                }
            )
        }
        if (Test-Path $settingsPath) {
            $raw = [System.IO.File]::ReadAllText($settingsPath)
            $obj = $null
            try { $obj = $raw | ConvertFrom-Json } catch { $obj = $null }
            if ($null -eq $obj) {
                $hookNote = "settings.json 解析失败，未改动（需手工并入）"
            } elseif (($raw -match "quality-gate-hook") -and -not $Force) {
                $hookNote = "已存在 hooks（跳过；需覆盖加 -Force）"
            } else {
                Copy-Item -Path $settingsPath -Destination "$settingsPath.bak" -Force
                if ($obj.PSObject.Properties.Name -contains "hooks") {
                    $obj.hooks = $hookObj
                } else {
                    $obj | Add-Member -NotePropertyName hooks -NotePropertyValue $hookObj -Force
                }
                # UTF-8 无 BOM：BOM 会让 JSON 解析失败
                [System.IO.File]::WriteAllText($settingsPath, ($obj | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
                $hookNote = "已合并 hooks（原文件备份为 settings.json.bak；重启会话生效）"
            }
        } else {
            Copy-Item -Path (Join-Path $qoderSrc "settings.hooks.json") -Destination $settingsPath -Force
            $hookNote = "settings.json 不存在，已按 hooks 模板创建"
        }
    }

    $rows += [PSCustomObject]@{
        Home    = $homeDir
        Skills  = $counts.skills
        Agents  = $counts.agents
        Scripts = $counts.scripts
        Drift   = $drift.Count
        Details = $drift
        Hooks   = $hookNote
    }
}

$badDrift = @($rows | Where-Object { $_.Drift -gt 0 })
$status = if ($badDrift.Count -eq 0) { "PASS" } else { "FAIL" }

# -Json 时不得有任何 Write-Host：PS 5.1 下 host 输出会一起进 stdout 重定向，导致调用方（Agent/python）解析失败
if ($Json) {
    [PSCustomObject]@{
        status = $status
        source = $RepoRoot
        homes  = $rows
        absent = $absent
    } | ConvertTo-Json -Compress -Depth 6
} else {
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " all-in-mvp 用户级同步 — 源 $RepoRoot" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    foreach ($r in $rows) {
        Write-Host "[$($r.Home)] skills=$($r.Skills) agents=$($r.Agents) scripts=$($r.Scripts) hooks=$($r.Hooks)" -ForegroundColor Green
        if ($r.Drift -gt 0) {
            Write-Host "  [DRIFT] 与仓库不一致 $($r.Drift) 个文件：" -ForegroundColor Red
            $r.Details | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
        } else {
            Write-Host "  [MATCH] skills/agents/scripts 与仓库逐字节一致" -ForegroundColor Green
        }
    }
    foreach ($a in $absent) { Write-Host "[SKIP] ~\$a 不存在（本机未安装该形态的 Qoder）" -ForegroundColor DarkGray }
    if ($status -eq "PASS") {
        Write-Host "[PASS] 全部 home 已同步；技能与子 Agent 需重启 Qoder 才会重新加载" -ForegroundColor Cyan
    } else {
        Write-Host "[FAIL] 存在同步漂移，全局调用仍可能读到旧版本" -ForegroundColor Red
    }
}

if ($badDrift.Count -gt 0) { exit 1 }
exit 0

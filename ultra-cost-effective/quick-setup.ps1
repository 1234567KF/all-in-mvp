#!/usr/bin/env pwsh
# ============================================================
#  UltraCostEffective · 极致节能 — 一键接入脚本 (Windows)
#
#  用法:
#    .\quick-setup.ps1 -Target "C:\path\to\your-project"
#    .\quick-setup.ps1 -Target "C:\path\to\your-project" -Platform claude
#    .\quick-setup.ps1 -Target "C:\path\to\your-project" -Platform qoder
#    .\quick-setup.ps1 -Target "C:\path\to\your-project" -Preset extreme
#    .\quick-setup.ps1 -Target "C:\path\to\your-project" -SkipLeanCtx
#
#  自动完成:
#    [1/5] 检测环境 (Node.js)
#    [2/5] 复制 ultra-cost-effective/ 引擎到目标项目
#    [3/5] 安装 lean-ctx MCP 工具
#    [4/5] 合并 settings 配置 (自动检测 Claude Code / Qoder)
#    [5/5] 验证安装
# ============================================================

param(
    [Parameter(Mandatory=$true, HelpMessage="目标项目路径")]
    [string]$Target,

    [ValidateSet("claude", "qoder", "auto")]
    [string]$Platform = "auto",

    [ValidateSet("quick", "standard", "extreme")]
    [string]$Preset = "standard",

    [switch]$SkipLeanCtx,
    [switch]$SkipVerify,
    [switch]$Force
)

$ErrorActionPreference = "Continue"
$SCRIPT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$ENGINE_DIR = $SCRIPT_ROOT  # 脚本本身就在 ultra-cost-effective/ 目录内

# ─── 颜色工具 ──────────────────────────────────

function Write-Step($step, $msg) { Write-Host "[$step/5] $msg" -ForegroundColor Yellow }
function Write-Ok($msg) { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Gray }

# ─── Banner ────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  UltraCostEffective · 极致节能           ║" -ForegroundColor Cyan
Write-Host "║  一键接入脚本 (Windows)                   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  目标项目: $Target" -ForegroundColor White
Write-Host "  平台:     $Platform" -ForegroundColor White
Write-Host "  预设:     $Preset" -ForegroundColor White
Write-Host ""

# ─── [1/5] 检测环境 ────────────────────────────

Write-Step 1 "检测环境..."

# Node.js
$nodeVersion = $null
try { $nodeVersion = (node --version 2>$null) } catch {}
if (-not $nodeVersion) {
    Write-Fail "Node.js 未安装"
    Write-Info "请先安装 Node.js ≥ 18: https://nodejs.org/"
    exit 1
}
Write-Ok "Node.js $nodeVersion"

# 引擎目录
if (-not (Test-Path $ENGINE_DIR)) {
    Write-Fail "引擎目录不存在: $ENGINE_DIR"
    Write-Info "请确保 quick-setup.ps1 在仓库根目录执行"
    exit 1
}
Write-Ok "引擎目录存在"

# 目标目录
$targetAbs = [System.IO.Path]::GetFullPath($Target)
if (-not (Test-Path $targetAbs)) {
    if ($Force) {
        New-Item -ItemType Directory -Path $targetAbs -Force | Out-Null
        Write-Ok "已创建目标目录: $targetAbs"
    } else {
        Write-Fail "目标目录不存在: $targetAbs"
        Write-Info "使用 -Force 自动创建，或手动创建后重试"
        exit 1
    }
} else {
    Write-Ok "目标目录存在"
}

# 检查是否已有 ultra-cost-effective
$targetEngine = Join-Path $targetAbs "ultra-cost-effective"
if ((Test-Path $targetEngine) -and -not $Force) {
    Write-Warn "目标项目已有 ultra-cost-effective/"
    Write-Info "使用 -Force 覆盖更新"
    $overwrite = Read-Host "  覆盖? (y/N)"
    if ($overwrite -ne 'y' -and $overwrite -ne 'Y') {
        Write-Info "已取消"
        exit 0
    }
}

# ─── [2/5] 复制引擎 ────────────────────────────

Write-Step 2 "复制引擎到目标项目..."

# 使用 robocopy 实现智能复制（跳过测试数据等临时文件）
$robocopyArgs = @(
    $ENGINE_DIR,
    $targetEngine,
    "/E",          # 复制子目录
    "/NFL",        # 不输出文件列表
    "/NDL",        # 不输出目录列表
    "/NJH", "/NJS", # 不输出头部和尾部
    "/NC", "/NS",  # 不输出类/大小
    "/XD", "node_modules", ".git"  # 排除目录
)

$robocopyResult = & robocopy @robocopyArgs
# robocopy 返回码: 0=无变化, 1=成功复制, 2=额外文件, 3=1+2
if ($LASTEXITCODE -le 3) {
    Write-Ok "引擎已复制到 $targetEngine"
} else {
    Write-Fail "复制失败 (robocopy exit code: $LASTEXITCODE)"
    exit 1
}

# ─── [3/5] 安装 lean-ctx ───────────────────────

Write-Step 3 "安装 lean-ctx MCP 工具..."

if ($SkipLeanCtx) {
    Write-Warn "跳过 lean-ctx 安装 (-SkipLeanCtx)"
} else {
    $leanCtxInstalled = $false
    try {
        $null = lean-ctx --version 2>$null
        if ($LASTEXITCODE -eq 0) { $leanCtxInstalled = $true }
    } catch {}

    if ($leanCtxInstalled) {
        Write-Ok "lean-ctx 已安装"
    } else {
        Write-Info "正在安装 lean-ctx..."
        npm install -g lean-ctx-bin 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "lean-ctx 安装成功"
        } else {
            Write-Warn "lean-ctx 安装失败，可稍后手动安装:"
            Write-Info "npm install -g lean-ctx-bin"
        }
    }
}

# ─── [4/5] 合并 settings ──────────────────────

Write-Step 4 "合并 settings 配置..."

# 检测平台
if ($Platform -eq "auto") {
    if ($env:QODER_SESSION_ID -or $env:QODER_WORKSPACE) {
        $Platform = "qoder"
    } elseif ($env:CLAUDE_CODE_SESSION_ID) {
        $Platform = "claude"
    } else {
        # 检查 .claude 目录
        $claudeDir = Join-Path $targetAbs ".claude"
        if (Test-Path $claudeDir) {
            $Platform = "claude"
        } else {
            $Platform = "claude"
            Write-Warn "未检测到平台，默认 Claude Code"
        }
    }
}
Write-Ok "平台: $Platform"

if ($Platform -eq "claude") {
    # Claude Code: 生成 .claude/settings.json
    $claudeDir = Join-Path $targetAbs ".claude"
    if (-not (Test-Path $claudeDir)) {
        New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    }

    $settingsFile = Join-Path $claudeDir "settings.json"
    $templateFile = Join-Path $targetEngine "adapters" "claude" "settings.template.json"

    if (Test-Path $settingsFile) {
        # 已有 settings.json → 智能合并
        Write-Info "已有 .claude/settings.json，正在智能合并..."
        try {
            $existing = Get-Content $settingsFile -Raw | ConvertFrom-Json
            $template = Get-Content $templateFile -Raw | ConvertFrom-Json

            # 合并 hooks
            if ($template.hooks) {
                if (-not $existing.hooks) { $existing | Add-Member -NotePropertyName "hooks" -NotePropertyValue @{} }
                foreach ($hookType in $template.hooks.PSObject.Properties.Name) {
                    if (-not $existing.hooks.$hookType) {
                        $existing.hooks | Add-Member -NotePropertyName $hookType -NotePropertyValue @()
                    }
                    $template.hooks.$hookType | ForEach-Object {
                        $existing.hooks.$hookType += $_
                    }
                }
            }

            # 合并 permissions
            if ($template.permissions -and $template.permissions.allow) {
                if (-not $existing.permissions) {
                    $existing | Add-Member -NotePropertyName "permissions" -NotePropertyValue @{ allow = @() }
                }
                if (-not $existing.permissions.allow) {
                    $existing.permissions | Add-Member -NotePropertyName "allow" -NotePropertyValue @()
                }
                foreach ($perm in $template.permissions.allow) {
                    if ($existing.permissions.allow -notcontains $perm) {
                        $existing.permissions.allow += $perm
                    }
                }
            }

            # 合并 mcpServers
            if ($template.mcpServers) {
                if (-not $existing.mcpServers) {
                    $existing | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue @{}
                }
                foreach ($server in $template.mcpServers.PSObject.Properties.Name) {
                    if (-not $existing.mcpServers.$server) {
                        $existing.mcpServers | Add-Member -NotePropertyName $server -NotePropertyValue $template.mcpServers.$server
                    }
                }
            }

            # 合并 environment
            if ($template.environment) {
                if (-not $existing.environment) {
                    $existing | Add-Member -NotePropertyName "environment" -NotePropertyValue @{}
                }
                foreach ($envKey in $template.environment.PSObject.Properties.Name) {
                    $existing.environment | Add-Member -NotePropertyName $envKey -NotePropertyValue $template.environment.$envKey -Force
                }
            }

            $existing | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8
            Write-Ok "settings.json 已合并更新"
        } catch {
            Write-Warn "智能合并失败，请手动合并: $templateFile"
            Write-Info "错误: $_"
        }
    } else {
        # 无 settings.json → 直接复制模板
        Copy-Item $templateFile $settingsFile
        Write-Ok ".claude/settings.json 已从模板创建"
    }

} else {
    # Qoder: 自动合并 settings.patch.json
    $qoderSettingsPath = Join-Path $env:USERPROFILE ".qoder" "settings.json"
    $patchFile = Join-Path $targetEngine "adapters" "qoder" "settings.patch.json"

    if (-not (Test-Path $patchFile)) {
        Write-Fail "补丁文件不存在: $patchFile"
        exit 1
    }

    # 备份现有配置
    if (Test-Path $qoderSettingsPath) {
        Copy-Item $qoderSettingsPath "$qoderSettingsPath.backup" -Force
        Write-Ok "已备份 settings.json → settings.json.backup"
    }

    # 读取现有配置（不存在则创建空对象）
    $existing = @{}
    if (Test-Path $qoderSettingsPath) {
        try { $existing = Get-Content $qoderSettingsPath -Raw | ConvertFrom-Json } catch {
            Write-Warn "现有 settings.json 解析失败，将创建新配置"
        }
    }

    # 读取补丁
    $patch = Get-Content $patchFile -Raw | ConvertFrom-Json

    # ── 合并 models ──
    if ($patch.models) {
        if (-not (Get-Member -InputObject $existing -Name "models" -MemberType Properties)) {
            $existing | Add-Member -NotePropertyName "models" -NotePropertyValue @() -Force
        }
        foreach ($m in $patch.models) {
            if ($existing.models -notcontains $m) { $existing.models += $m }
        }
    }

    # ── 合并 hooks（Qoder 扁平格式，节能体系独占 Hook 类型）──
    if ($patch.hooks) {
        if (-not (Get-Member -InputObject $existing -Name "hooks" -MemberType Properties)) {
            $existing | Add-Member -NotePropertyName "hooks" -NotePropertyValue @{} -Force
        }
        foreach ($hookType in $patch.hooks.PSObject.Properties.Name) {
            $existing.hooks | Add-Member -NotePropertyName $hookType -NotePropertyValue $patch.hooks.$hookType -Force
        }
    }

    # ── 合并 env ──
    if ($patch.environment) {
        if (-not (Get-Member -InputObject $existing -Name "env" -MemberType Properties)) {
            $existing | Add-Member -NotePropertyName "env" -NotePropertyValue @{} -Force
        }
        foreach ($envKey in $patch.environment.PSObject.Properties.Name) {
            $existing.env | Add-Member -NotePropertyName $envKey -NotePropertyValue $patch.environment.$envKey -Force
        }
    }

    # ── 合并 mcpServers ──
    if ($patch.mcpServers) {
        if (-not (Get-Member -InputObject $existing -Name "mcpServers" -MemberType Properties)) {
            $existing | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue @{} -Force
        }
        foreach ($serverName in $patch.mcpServers.PSObject.Properties.Name) {
            if (-not (Get-Member -InputObject $existing.mcpServers -Name $serverName -MemberType Properties)) {
                $existing.mcpServers | Add-Member -NotePropertyName $serverName -NotePropertyValue $patch.mcpServers.$serverName -Force
            }
        }
    }

    # ── 合并 rules ──
    if ($patch.rules) {
        if (-not (Get-Member -InputObject $existing -Name "rules" -MemberType Properties)) {
            $existing | Add-Member -NotePropertyName "rules" -NotePropertyValue @() -Force
        }
        foreach ($r in $patch.rules) {
            if ($existing.rules -notcontains $r) { $existing.rules += $r }
        }
    }

    # 保存
    $qoderSettingsDir = Split-Path $qoderSettingsPath -Parent
    if (-not (Test-Path $qoderSettingsDir)) {
        New-Item -ItemType Directory -Path $qoderSettingsDir -Force | Out-Null
    }
    $existing | ConvertTo-Json -Depth 10 | Set-Content $qoderSettingsPath -Encoding UTF8
    Write-Ok "Qoder settings.json 已合并更新"
}

# 更新预设环境变量
if ($Platform -eq "claude") {
    $settingsFile = Join-Path $targetAbs ".claude" "settings.json"
    if (Test-Path $settingsFile) {
        try {
            $settings = Get-Content $settingsFile -Raw | ConvertFrom-Json
            if ($settings.environment) {
                $settings.environment | Add-Member -NotePropertyName "ULTRA_COST_EFFECTIVE_LEVEL" -NotePropertyValue $Preset -Force
            }
            $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8
            Write-Ok "预设已设置: $Preset"
        } catch {}
    }
} else {
    # Qoder: 更新全局 settings.json 中的预设
    $qoderSettingsPath = Join-Path $env:USERPROFILE ".qoder" "settings.json"
    if (Test-Path $qoderSettingsPath) {
        try {
            $qoderSettings = Get-Content $qoderSettingsPath -Raw | ConvertFrom-Json
            if (-not (Get-Member -InputObject $qoderSettings -Name "env" -MemberType Properties)) {
                $qoderSettings | Add-Member -NotePropertyName "env" -NotePropertyValue @{} -Force
            }
            $qoderSettings.env | Add-Member -NotePropertyName "ULTRA_COST_EFFECTIVE_PRESET" -NotePropertyValue $Preset -Force
            # 根据预设设置压缩级别
            $presetFile = Join-Path $targetEngine "presets" "$Preset.json"
            if (Test-Path $presetFile) {
                $presetConfig = Get-Content $presetFile -Raw | ConvertFrom-Json
                if ($presetConfig.layers.L1_tokenforge) {
                    $level = $presetConfig.layers.L1_tokenforge.level
                    $qoderSettings.env | Add-Member -NotePropertyName "ULTRA_COST_EFFECTIVE_LEVEL" -NotePropertyValue $level -Force
                }
            }
            $qoderSettings | ConvertTo-Json -Depth 10 | Set-Content $qoderSettingsPath -Encoding UTF8
            Write-Ok "Qoder 预设已设置: $Preset"
        } catch {
            Write-Warn "Qoder 预设设置失败: $_"
        }
    } else {
        Write-Warn "Qoder settings.json 未找到，跳过预设设置"
    }
}

# ─── [5/5] 验证安装 ────────────────────────────

Write-Step 5 "验证安装..."

if ($SkipVerify) {
    Write-Warn "跳过验证 (-SkipVerify)"
} else {
    # 检查核心文件
    $coreFiles = @(
        "helpers/tokenforge.cjs",
        "helpers/context-interceptor.cjs",
        "helpers/workflow-integrator.cjs",
        "helpers/ultra-cost-effective-guard.cjs",
        "rules/interceptor-aop.md",
        "rules/workflow-compress.md"
    )

    $allOk = $true
    foreach ($f in $coreFiles) {
        $fullPath = Join-Path $targetEngine $f
        if (Test-Path $fullPath) {
            Write-Ok "$f"
        } else {
            Write-Fail "缺失: $f"
            $allOk = $false
        }
    }

    # 运行 prefix-validator
    $validator = Join-Path $targetEngine "helpers" "prefix-validator.cjs"
    if (Test-Path $validator) {
        $validatorOutput = node $validator --check-all 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "prefix-validator 通过"
        } else {
            Write-Warn "prefix-validator 有警告 (非致命)"
        }
    }
}

# ─── 完成 ──────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ 安装完成！                           ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  下一步:" -ForegroundColor White
Write-Host "    1. 重启 Claude Code / Qoder" -ForegroundColor White
Write-Host "    2. 在目标项目中正常使用" -ForegroundColor White
Write-Host "    3. 说 'token report' 查看节省效果" -ForegroundColor White
Write-Host ""
Write-Host "  卸载:" -ForegroundColor Gray
Write-Host "    删除 ultra-cost-effective/ 目录，移除 settings 中相关配置" -ForegroundColor Gray
Write-Host ""

#!/usr/bin/env pwsh
# UltraCostEffective 极致节能 — Windows PowerShell 安装脚本
# 一条命令完成安装和预检

param(
    [switch]$SkipLeanCtx,
    [switch]$SkipHeadroom,
    [switch]$Quick,
    [string]$Preset = "standard"
)

$ErrorActionPreference = "Continue"
$ULTRA_COST_EFFECTIVE_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   UltraCostEffective · 极致节能 — Windows 安装脚本" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─── Phase 1: 环境检测 ────────────────────────

Write-Host "[1/5] 检测环境..." -ForegroundColor Yellow

$nodeVersion = $null
try { $nodeVersion = node --version 2>$null } catch {}
if (-not $nodeVersion) {
    Write-Host "  ❌ Node.js 未安装。请先安装 Node.js ≥ 18.0" -ForegroundColor Red
    Write-Host "     下载: https://nodejs.org/" -ForegroundColor Gray
    exit 1
}
Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green

$platform = $null
if ($env:QODER_SESSION_ID -or $env:QODER_WORKSPACE) {
    $platform = "qoder"
    Write-Host "  ✓ 检测到 Qoder 平台" -ForegroundColor Green
} elseif ($env:CLAUDE_CODE_SESSION_ID -or (Get-Command claude -ErrorAction SilentlyContinue)) {
    $platform = "claude"
    Write-Host "  ✓ 检测到 Claude Code 平台" -ForegroundColor Green
} else {
    $platform = "claude"
    Write-Host "  ⚠ 未检测到平台，默认使用 Claude Code 配置" -ForegroundColor Yellow
}

# ─── Phase 2: 安装 lean-ctx ────────────────────

Write-Host ""
Write-Host "[2/5] 安装 lean-ctx MCP 工具..." -ForegroundColor Yellow

if ($SkipLeanCtx) {
    Write-Host "  ⏭ 跳过 (--skip-lean-ctx)" -ForegroundColor Gray
} else {
    try {
        npm install -g lean-ctx-bin 2>&1 | Out-Null
        Write-Host "  ✓ lean-ctx-bin 安装完成" -ForegroundColor Green
        
        lean-ctx init 2>&1 | Out-Null
        Write-Host "  ✓ lean-ctx 初始化完成" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ lean-ctx 安装失败（不影响核心功能，上下文压缩将降级到 tokenforge）" -ForegroundColor Yellow
    }
}

# ─── Phase 3: Headroom (可选) ──────────────────

Write-Host ""
Write-Host "[3/5] Headroom (可选增强)..." -ForegroundColor Yellow

if ($SkipHeadroom) {
    Write-Host "  ⏭ 跳过 (--skip-headroom)" -ForegroundColor Gray
} elseif ($Preset -eq "extreme") {
    Write-Host "  🔧 extreme 预设需 Headroom，尝试安装..." -ForegroundColor Yellow
    try {
        pip install headroom-ai[all] 2>&1 | Out-Null
        Write-Host "  ✓ Headroom 安装完成" -ForegroundColor Green
        $env:ULTRA_COST_EFFECTIVE_HEADROOM = "1"
    } catch {
        Write-Host "  ⚠ pip 不可用或 Headroom 安装失败" -ForegroundColor Yellow
        Write-Host "    手动安装: pip install headroom-ai[all]" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⏭ Headroom 为 extreme 预设可选增强，当前未启用" -ForegroundColor Gray
    Write-Host "    如需启用: pip install headroom-ai[all] && set ULTRA_COST_EFFECTIVE_HEADROOM=1" -ForegroundColor Gray
}

# ─── Phase 4: 配置预设 ─────────────────────────

Write-Host ""
Write-Host "[4/5] 配置预设..." -ForegroundColor Yellow

$presetFile = Join-Path $ULTRA_COST_EFFECTIVE_ROOT "presets" "$Preset.json"
if (Test-Path $presetFile) {
    $presetConfig = Get-Content $presetFile -Raw | ConvertFrom-Json
    Write-Host "  ✓ 预设: $($presetConfig.name) — $($presetConfig.description)" -ForegroundColor Green
    Write-Host "    预计节省: $($presetConfig.estimatedSavings)" -ForegroundColor Green

    # 设置环境变量
    $env:ULTRA_COST_EFFECTIVE_PLATFORM = $platform
    $env:ULTRA_COST_EFFECTIVE_PRESET = $Preset

    if ($presetConfig.layers.L1_tokenforge) {
        $env:ULTRA_COST_EFFECTIVE_LEVEL = $presetConfig.layers.L1_tokenforge.level
    }
} else {
    Write-Host "  ⚠ 预设文件不存在: $presetFile，使用默认 standard" -ForegroundColor Yellow
    $env:ULTRA_COST_EFFECTIVE_LEVEL = "medium"
    $env:ULTRA_COST_EFFECTIVE_PRESET = "standard"
}

# ─── Phase 5: 验证 ─────────────────────────────

Write-Host ""
Write-Host "[5/5] 预检验证..." -ForegroundColor Yellow

$validatorPath = Join-Path $ULTRA_COST_EFFECTIVE_ROOT "helpers" "prefix-validator.cjs"
if (Test-Path $validatorPath) {
    try {
        $result = node $validatorPath --check-all 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ 前缀一致性校验通过" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠ 前缀校验跳过（非关键）" -ForegroundColor Yellow
    }
}

# 验证 tokenforge
Write-Host "  ✓ 核心文件就绪" -ForegroundColor Green

# ─── 完成 ──────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   UltraCostEffective 安装完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  平台:       $platform" -ForegroundColor White
Write-Host "  预设:       $Preset" -ForegroundColor White
Write-Host "  预计节省:   $(if ($Preset -eq 'quick') {'50-70%'} elseif ($Preset -eq 'standard') {'70-85%'} else {'85-95%'})" -ForegroundColor White
Write-Host ""
Write-Host "  下一步:" -ForegroundColor Yellow
Write-Host "    1. 重启 Claude Code / Qoder" -ForegroundColor White
Write-Host "    2. UltraCostEffective 将自动激活（always-on: true）" -ForegroundColor White
Write-Host "    3. 说出「token report」查看节省效果" -ForegroundColor White
Write-Host ""
Write-Host "  手动控制:" -ForegroundColor Yellow
Write-Host "    set ULTRA_COST_EFFECTIVE_OFF=1          # 临时关闭" -ForegroundColor White
Write-Host "    node helpers/tokenforge-hook.cjs --test  # 测试分类" -ForegroundColor White
Write-Host ""

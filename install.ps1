# ============================================================
#  all-in-mvp 项目级技能安装脚本 - Windows PowerShell
# ============================================================
#
#  用法：
#
# ① 一行命令（推荐）：
#    npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
#    → .claude/skills/ .qoder/skills/ .trae/skills/ 已在项目根目录
#    → 启动 Qoder / Claude Code 即可使用
#
# ② 验证安装：
#    .\install.ps1
#
# ③ 远程一键安装（下载到当前目录）：
#    irm https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.ps1 | iex
#
# 原理：技能在项目级目录（.claude/.qoder/.trae/skills/），
# Agent 自动识别，优先级高于全局。不污染全局配置。
# ============================================================

param(
    [switch]$Version,
    [switch]$Help
)

function Write-Success { param([string]$M) Write-Host "✓ $M" -ForegroundColor Green }
function Write-Warning  { param([string]$M) Write-Host "⚠ $M" -ForegroundColor Yellow }
function Write-Error    { param([string]$M) Write-Host "✗ $M" -ForegroundColor Red }
function Write-Info     { param([string]$M) Write-Host "ℹ $M" -ForegroundColor Blue }
function Write-Header   { param([string]$M) Write-Host $M -ForegroundColor Cyan }

function Test-Command { param([string]$C) return [bool](Get-Command -Name $C -ErrorAction SilentlyContinue) }

# --- 检测项目级技能目录 ---
function Check-Skills {
    Write-Host ""
    Write-Info "检测项目级技能目录..."
    $missing = $false

    foreach ($dir in @(".claude\skills", ".qoder\skills", ".trae\skills")) {
        $full = Join-Path $script:SCRIPT_DIR $dir
        if (Test-Path $full) {
            $count = (Get-ChildItem $full -Directory -ErrorAction SilentlyContinue).Count
            Write-Success "$dir 已就绪（$count 个技能）"
        } else {
            Write-Warning "$dir 缺失"
            $missing = $true
        }
    }

    return -not $missing
}

# --- 远程模式：下载技能到当前项目目录 ---
function Download-Skills {
    if (-not (Test-Command "npx")) {
        Write-Error "需要 Node.js / npx，请先安装"
        exit 1
    }

    Write-Info "从 GitHub 下载技能到项目目录..."

    foreach ($target in @(".claude/skills", ".qoder/skills", ".trae/skills")) {
        Write-Info "下载 $target..."
        $dst = Join-Path $script:SCRIPT_DIR $target
        npx.cmd giget "gh:1234567KF/all-in-mvp#all-in-mvp/$target" $dst --force
        Write-Success "$target 下载完成"
    }
}

# --- 检测已安装的 AI Agent ---
function Get-Agents {
    $agents = @()
    if (Test-Path "$env:USERPROFILE\.qoder")  { $agents += "qoder";  Write-Success "检测到 Qoder" }
    if (Test-Path "$env:USERPROFILE\.claude") { $agents += "claude"; Write-Success "检测到 Claude Code" }
    if ($agents.Count -eq 0) {
        Write-Warning "未检测到已安装的 AI Agent"
        Write-Info "技能已在项目目录，安装 Agent 后即可使用"
    }
    return $agents
}

# --- 帮助 ---
function Show-Help {
    Write-Host "all-in-mvp 项目级技能安装 (PowerShell)"
    Write-Host ""
    Write-Host "技能放在项目根目录 .claude\skills\ .qoder\skills\ .trae\skills\"
    Write-Host "Agent 自动识别，项目级优先，不污染全局。"
    Write-Host ""
    Write-Host "一行命令："
    Write-Host "  npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force"
}

# --- 主函数 ---
function Main {
    $script:SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

    if ($Version) { Write-Host "all-in-mvp installer v2.9.1"; return }
    if ($Help)    { Show-Help; return }

    Write-Header "============================"
    Write-Header "  all-in-mvp 项目级技能 v2.9.1"
    Write-Header "============================"

    if (Check-Skills) {
        Write-Host ""
        Write-Success "所有技能已就绪！"
    } else {
        Write-Info "下载缺失的技能到项目目录..."
        Download-Skills
        Write-Host ""
        Check-Skills | Out-Null
    }

    Write-Host ""
    $agents = Get-Agents
    Write-Host ""
    Write-Header "========================"
    Write-Success "完成！"
    Write-Host ""
    Write-Info "技能目录（项目级）："
    Write-Host "  .claude\skills\  .qoder\skills\  .trae\skills\"
    Write-Host ""
    Write-Info "使用方法："
    Write-Host "  在本项目目录启动 Qoder / Claude Code"
    Write-Host "  输入：使用 all-in-mvp 创建一个 CRM 系统"
    Write-Host ""
}

Main


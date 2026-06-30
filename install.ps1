# ============================================================
#  all-in-mvp 一键安装脚本 - Windows PowerShell（简化版）
# ============================================================
#
#  用法：
#
# ① giget 拉取后本地安装（推荐）：
#    npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp my-project `
#      --ignore "AGENTS.md,CLAUDE.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
#    cd my-project
#    .\install.ps1
#
# ② 远程一键安装：
#    irm https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.ps1 | iex
#
# 原理：推库前 pre-push hook 已自动同步 skills →
# .claude/skills/ + .qoder/skills/ + .trae/skills/，
# 本脚本只需将已融合的技能复制到全局配置目录。
# 同时兜底清理根目录中的冗余文档文件（主防线是 --ignore）。
# ============================================================

param(
    [string]$Agent = "",
    [switch]$Version,
    [switch]$Help
)

function Write-Success { param([string]$M) Write-Host "✓ $M" -ForegroundColor Green }
function Write-Warning  { param([string]$M) Write-Host "⚠ $M" -ForegroundColor Yellow }
function Write-Error    { param([string]$M) Write-Host "✗ $M" -ForegroundColor Red }
function Write-Info     { param([string]$M) Write-Host "ℹ $M" -ForegroundColor Blue }
function Write-Header   { param([string]$M) Write-Host $M -ForegroundColor Cyan }

function Test-Command { param([string]$C) return [bool](Get-Command -Name $C -ErrorAction SilentlyContinue) }

# --- 清理根目录冗余文件（兜底：--ignore 是主防线，此处补漏）---
function Clear-Root {
    param([string]$Root = ".")
    Write-Info "清理根目录冗余文件..."
    @("AGENTS.md","README.md","INSTALL.md","WhyMe.md","screenshot-1-full.png","nul","CLAUDE.md") | ForEach-Object {
        Remove-Item "$Root\$_" -Force -ErrorAction SilentlyContinue
    }
    Remove-Item "$Root\all-in-mvp-*.md" -Force -ErrorAction SilentlyContinue
    Remove-Item "$Root\MVP*" -Force -ErrorAction SilentlyContinue
    @("shadcn","tools","overlays","ultra-cost-effective") | ForEach-Object {
        Remove-Item "$Root\$_" -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Success "根目录清理完成"
}

# --- 安装技能（从本地目录复制）---
function Install-Skills {
    param([string]$AgentName)

    $srcDir = ""
    $dstDir = ""

    switch ($AgentName) {
        "qoder"  { $srcDir = "$script:SCRIPT_DIR\.qoder\skills";  $dstDir = "$env:USERPROFILE\.qoder\skills" }
        "claude" { $srcDir = "$script:SCRIPT_DIR\.claude\skills"; $dstDir = "$env:USERPROFILE\.claude\skills" }
        default  { Write-Error "未知 Agent: $AgentName"; return }
    }

    Write-Info "安装 $AgentName 技能..."

    if (Test-Path $srcDir) {
        # 方案 A：本地已有（giget 拉取的项目），直接复制
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        Copy-Item -Path "$srcDir\*" -Destination "$dstDir\" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "$AgentName 技能已安装 ($dstDir)"
    } else {
        # 方案 B：远程模式（irm 管道），用 giget 下载
        if (Test-Command "npx") {
            Write-Info "从 GitHub 下载 $AgentName 技能..."
            npx.cmd giget "gh:1234567KF/all-in-mvp#all-in-mvp/skills" $dstDir --force `
              --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
            Write-Success "$AgentName 技能已安装（远程）"
        } else {
            Write-Error "未找到 npx，请先安装 Node.js"
        }
    }
}

# --- 检测已安装的 AI Agent ---
function Get-Agents {
    $agents = @()
    if (Test-Path "$env:USERPROFILE\.qoder")  { $agents += "qoder";  Write-Success "检测到 Qoder" }
    if (Test-Path "$env:USERPROFILE\.claude") { $agents += "claude"; Write-Success "检测到 Claude Code" }
    if ($agents.Count -eq 0) {
        Write-Warning "未检测到已安装的 AI Agent"
        Write-Info "请先安装 Qoder 或 Claude Code"
        exit 1
    }
    return $agents
}

# --- 帮助 ---
function Show-Help {
    Write-Host "all-in-mvp 技能安装脚本 (PowerShell)"
    Write-Host ""
    Write-Host "使用方法："
    Write-Host "  .\install.ps1 [options]"
    Write-Host ""
    Write-Host "选项："
    Write-Host "  -Agent <name>  指定平台 (qoder/claude)"
    Write-Host "  -Version       显示版本"
    Write-Host "  -Help          帮助"
    Write-Host ""
    Write-Host "示例："
    Write-Host "  # giget 拉取后安装（推荐）"
    Write-Host "  npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp my-project ``"
    Write-Host "    --ignore `"AGENTS.md,...ultra-cost-effective/**`""
    Write-Host "  cd my-project ; .\install.ps1"
    Write-Host ""
    Write-Host "  # 远程一键安装"
    Write-Host "  irm https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.ps1 | iex"
}

# --- 主函数 ---
function Main {
    $script:SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

    if ($Version) { Write-Host "all-in-mvp installer v2.9.0"; return }
    if ($Help)    { Show-Help; return }

    Write-Header "============================"
    Write-Header "  all-in-mvp 技能安装 v2.9.0"
    Write-Header "============================"
    Write-Host ""

    # 清理根目录冗余文件（替代 giget --ignore）
    Clear-Root $script:SCRIPT_DIR
    Write-Host ""

    if ($Agent -ne "") {
        Install-Skills $Agent
    } else {
        $agents = Get-Agents
        Write-Host ""
        Write-Header "开始安装技能..."
        Write-Host ""
        foreach ($a in $agents) {
            Install-Skills $a
            Write-Host ""
        }
    }

    Write-Header "========================"
    Write-Success "安装完成！"
    Write-Host ""
    Write-Info "使用方式："
    Write-Host "  1. 进入你的项目目录"
    Write-Host "  2. 启动 AI Agent"
    Write-Host "  3. 输入指令激活技能，例如："
    Write-Host "     - 使用 all-in-mvp 创建一个 CRM 系统"
    Write-Host ""
}

Main

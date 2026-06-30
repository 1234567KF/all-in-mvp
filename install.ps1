# all-in-mvp 技能快速安装脚本 (Windows PowerShell)
# 
# 使用方法：
#   irm https://raw.githubusercontent.com/your-username/all-in-mvp/main/install.ps1 | iex
#   
#   或者下载后运行：
#   .\install.ps1

param(
    [string]$Agent = "",
    [switch]$Help
)

# 颜色函数
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Write-Header {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

# 检查命令是否存在
function Test-Command {
    param([string]$Command)
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

# 检查 Node.js 版本
function Test-NodeVersion {
    if (-not (Test-Command "node")) {
        Write-Error "未找到 Node.js，请先安装 Node.js >= 18.0.0"
        exit 1
    }
    
    $nodeVersion = node -v
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    
    if ($majorVersion -lt 18) {
        Write-Error "Node.js 版本过低，需要 >= 18.0.0，当前版本: $nodeVersion"
        exit 1
    }
    
    Write-Success "Node.js 版本检查通过: $nodeVersion"
}

# 检查 npm 版本
function Test-NpmVersion {
    if (-not (Test-Command "npm")) {
        Write-Error "未找到 npm，请先安装 npm >= 9.0.0"
        exit 1
    }
    
    $npmVersion = npm -v
    $majorVersion = [int]($npmVersion -split '\.')[0]
    
    if ($majorVersion -lt 9) {
        Write-Error "npm 版本过低，需要 >= 9.0.0，当前版本: $npmVersion"
        exit 1
    }
    
    Write-Success "npm 版本检查通过: $npmVersion"
}

# 检测 AI Agent
function Get-AiAgents {
    $agents = @()
    
    # 检测 Qoder
    if (Test-Path "$env:USERPROFILE\.qoder") {
        $agents += "qoder"
        Write-Success "检测到 Qoder"
    }
    
    # 检测 Claude Code
    if (Test-Path "$env:USERPROFILE\.claude") {
        $agents += "claude"
        Write-Success "检测到 Claude Code"
    }
    
    # 检测 Gemini
    if (Test-Path "$env:USERPROFILE\.gemini") {
        $agents += "gemini"
        Write-Success "检测到 Gemini"
    }
    
    if ($agents.Count -eq 0) {
        Write-Warning "未检测到已安装的 AI Agent"
        Write-Info "请先安装 Qoder、Claude Code 或 Gemini"
        exit 1
    }
    
    return $agents
}

# 安装技能到指定 Agent
function Install-ToAgent {
    param([string]$AgentName)
    
    $targetDir = ""
    
    switch ($AgentName) {
        "qoder" {
            $targetDir = "$env:USERPROFILE\.qoder\skills"
        }
        "claude" {
            $targetDir = "$env:USERPROFILE\.claude\skills"
        }
        "gemini" {
            $targetDir = "$env:USERPROFILE\.gemini\config\skills"
        }
        default {
            Write-Error "未知的 Agent: $AgentName"
            return
        }
    }
    
    Write-Info "安装到 $AgentName ($targetDir)..."
    
    # 创建目标目录
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    
    # 使用 npx giget 下载
    if (Test-Command "npx") {
        npx giget github:your-username/all-in-mvp/skills $targetDir --force
        Write-Success "$AgentName 技能安装完成"
    } else {
        Write-Error "未找到 npx，请先安装 npm"
        return
    }
}

# 安装所有技能
function Install-All {
    Write-Header "开始安装 all-in-mvp 技能..."
    Write-Host ""
    
    # 检查依赖
    Test-NodeVersion
    Test-NpmVersion
    
    # 检测 AI Agent
    $agents = Get-AiAgents
    
    Write-Host ""
    Write-Header "开始安装技能..."
    Write-Host ""
    
    # 安装到所有检测到的 Agent
    foreach ($agent in $agents) {
        Install-ToAgent $agent
        Write-Host ""
    }
    
    Write-Header "========================"
    Write-Success "所有技能安装完成！"
    Write-Host ""
    Write-Info "使用方法："
    Write-Host "  1. 进入你的项目目录"
    Write-Host "  2. 启动 AI Agent (qoder / claude / gemini)"
    Write-Host "  3. 输入指令激活技能，例如："
    Write-Host "     - 使用 all-in-mvp 创建一个 CRM 系统"
    Write-Host "     - 搭建 MVP 脚手架"
    Write-Host ""
    Write-Info "更新技能："
    Write-Host "  重新运行此脚本即可更新到最新版本"
    Write-Host ""
}

# 显示帮助信息
function Show-Help {
    Write-Host "all-in-mvp 技能快速安装脚本 (Windows PowerShell)"
    Write-Host ""
    Write-Host "使用方法："
    Write-Host "  .\install.ps1 [options]"
    Write-Host ""
    Write-Host "选项："
    Write-Host "  -Agent <name>  指定安装到的 Agent (qoder/claude/gemini)"
    Write-Host "  -Help          显示此帮助信息"
    Write-Host ""
    Write-Host "示例："
    Write-Host "  # 安装到所有检测到的 Agent"
    Write-Host "  .\install.ps1"
    Write-Host ""
    Write-Host "  # 只安装到 Qoder"
    Write-Host "  .\install.ps1 -Agent qoder"
    Write-Host ""
    Write-Host "  # 只安装到 Claude Code"
    Write-Host "  .\install.ps1 -Agent claude"
}

# 主函数
function Main {
    # 显示帮助
    if ($Help) {
        Show-Help
        return
    }
    
    # 显示欢迎信息
    Write-Header "============================"
    Write-Header "  all-in-mvp 技能安装脚本"
    Write-Header "============================"
    Write-Host ""
    
    # 如果指定了 Agent，只安装到该 Agent
    if ($Agent -ne "") {
        Test-NodeVersion
        Test-NpmVersion
        Install-ToAgent $Agent
    } else {
        # 否则安装到所有检测到的 Agent
        Install-All
    }
}

# 运行主函数
Main

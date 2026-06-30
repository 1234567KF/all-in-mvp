#!/bin/bash

# ============================================================
#  all-in-mvp 一键安装分发脚本
# ============================================================
# 
#  三种用法：
# 
#  ① giget 拉取后本地安装（推荐）：
#     npx giget gh:1234567KF/all-in-mvp my-mvp-project
#     cd my-mvp-project
#     chmod +x install.sh && ./install.sh
# 
#  ② 已 clone 仓库直接安装：
#     git clone https://github.com/1234567KF/all-in-mvp.git
#     cd all-in-mvp
#     chmod +x install.sh && ./install.sh
# 
#  ③ 远程一键安装：
#     curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh | bash
# 
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js 版本
check_node_version() {
    if ! command_exists node; then
        print_error "未找到 Node.js，请先安装 Node.js >= 18.0.0"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js 版本过低，需要 >= 18.0.0，当前版本: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js 版本检查通过: $(node -v)"
}

# 检查 npm 版本
check_npm_version() {
    if ! command_exists npm; then
        print_error "未找到 npm，请先安装 npm >= 9.0.0"
        exit 1
    fi
    
    NPM_VERSION=$(npm -v | cut -d'.' -f1)
    if [ "$NPM_VERSION" -lt 9 ]; then
        print_error "npm 版本过低，需要 >= 9.0.0，当前版本: $(npm -v)"
        exit 1
    fi
    
    print_success "npm 版本检查通过: $(npm -v)"
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
    
    print_info "检测到操作系统: $OS"
}

# 检测 AI Agent
detect_ai_agents() {
    AGENTS=()
    
    # 检测 Qoder
    if [ -d "$HOME/.qoder" ]; then
        AGENTS+=("qoder")
        print_success "检测到 Qoder"
    fi
    
    # 检测 Claude Code
    if [ -d "$HOME/.claude" ]; then
        AGENTS+=("claude")
        print_success "检测到 Claude Code"
    fi
    
    # 检测 Gemini
    if [ -d "$HOME/.gemini" ]; then
        AGENTS+=("gemini")
        print_success "检测到 Gemini"
    fi
    
    if [ ${#AGENTS[@]} -eq 0 ]; then
        print_warning "未检测到已安装的 AI Agent"
        print_info "请先安装 Qoder、Claude Code 或 Gemini"
        exit 1
    fi
}

# 安装技能到指定 Agent
install_to_agent() {
    local agent=$1
    local target_dir=""
    
    case $agent in
        "qoder")
            target_dir="$HOME/.qoder/skills"
            ;;
        "claude")
            target_dir="$HOME/.claude/skills"
            ;;
        "gemini")
            target_dir="$HOME/.gemini/config/skills"
            ;;
        *)
            print_error "未知的 Agent: $agent"
            return 1
            ;;
    esac
    
    print_info "安装到 $agent ($target_dir)..."
    
    # 创建目标目录
    mkdir -p "$target_dir"
    
    # 智能检测：优先使用本地 skills/，其次使用 sync 脚本，最后远程下载
    if [ "$USE_LOCAL" = true ] && [ -d "$SCRIPT_DIR/skills" ]; then
        # 方案 A：本地 skills 目录存在 → 使用 sync 脚本（含 overlay 融合）
        if [ -f "$SCRIPT_DIR/scripts/sync-skills.js" ] && command_exists node; then
            print_info "检测到本地仓库，使用 sync 脚本（含 overlay 融合）..."
            node "$SCRIPT_DIR/scripts/sync-skills.js" --mode push --target "$agent" --force
            print_success "$agent 技能安装完成（本地 sync）"
        else
            # 降级：直接复制
            print_info "使用本地 skills/ 目录直接复制..."
            cp -r "$SCRIPT_DIR/skills/"* "$target_dir/" 2>/dev/null || true
            print_success "$agent 技能安装完成（本地复制）"
        fi
    elif [ "$USE_REMOTE" = true ]; then
        # 方案 B：远程下载（curl 管道场景）
        if command_exists npx; then
            print_info "从 GitHub 远程下载 skills..."
            npx giget "gh:1234567KF/all-in-mvp/skills" "$target_dir" --force
            print_success "$agent 技能安装完成（远程下载）"
        else
            print_error "未找到 npx，请先安装 npm"
            return 1
        fi
    else
        # 方案 C：自动检测
        if [ -d "$SCRIPT_DIR/skills" ]; then
            USE_LOCAL=true
            install_to_agent "$agent"
        elif command_exists npx; then
            USE_REMOTE=true
            install_to_agent "$agent"
        else
            print_error "未找到本地 skills/ 目录，且 npx 不可用"
            print_info "请先运行: npx giget gh:1234567KF/all-in-mvp"
            return 1
        fi
    fi
}

# 安装所有技能
install_all() {
    print_header "开始安装 all-in-mvp 技能..."
    echo ""
    
    # 检查依赖
    check_node_version
    check_npm_version
    
    # 检测操作系统
    detect_os
    
    # 检测 AI Agent
    detect_ai_agents
    
    echo ""
    print_header "开始安装技能..."
    echo ""
    
    # 安装到所有检测到的 Agent
    for agent in "${AGENTS[@]}"; do
        install_to_agent "$agent"
        echo ""
    done
    
    print_header "========================"
    print_success "所有技能安装完成！"
    echo ""
    print_info "使用方法："
    echo "  1. 进入你的项目目录"
    echo "  2. 启动 AI Agent (qoder / claude / gemini)"
    echo "  3. 输入指令激活技能，例如："
    echo "     - 使用 all-in-mvp 创建一个 CRM 系统"
    echo "     - 搭建 MVP 脚手架"
    echo ""
    print_info "快速创建新项目（giget 一键拉取）："
    echo "  npx giget gh:1234567KF/all-in-mvp my-new-project"
    echo "  cd my-new-project && ./install.sh"
    echo ""
    print_info "更新技能："
    echo "  重新运行此脚本即可更新到最新版本"
    echo ""
}

# 显示帮助信息
show_help() {
    echo "all-in-mvp 技能快速安装脚本"
    echo ""
    echo "使用方法："
    echo "  ./install.sh [options]"
    echo ""
    echo "选项："
    echo "  --agent <name>    指定安装到的 Agent (qoder/claude/gemini)"
    echo "  --local           强制使用本地 skills/ 目录安装"
    echo "  --remote          强制从 GitHub 远程下载安装"
    echo "  --version         显示版本信息"
    echo "  --help            显示此帮助信息"
    echo ""
    echo "示例："
    echo "  # giget 拉取后本地安装（推荐）"
    echo "  npx giget gh:1234567KF/all-in-mvp my-project"
    echo "  cd my-project && ./install.sh"
    echo ""
    echo "  # 远程一键安装"
    echo "  curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh | bash"
    echo ""
    echo "  # 只安装到 Claude Code"
    echo "  ./install.sh --agent claude"
}

# 主函数
main() {
    # 获取脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    
    # 默认模式：自动检测
    USE_LOCAL=false
    USE_REMOTE=false
    SPECIFIC_AGENT=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --agent)
                SPECIFIC_AGENT="$2"
                shift 2
                ;;
            --local)
                USE_LOCAL=true
                shift
                ;;
            --remote)
                USE_REMOTE=true
                shift
                ;;
            --version)
                echo "all-in-mvp installer v2.7.0"
                exit 0
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 显示欢迎信息
    print_header "============================"
    print_header "  all-in-mvp 技能安装脚本"
    print_header "  v2.7.0"
    print_header "============================"
    echo ""
    
    # 如果指定了 Agent，只安装到该 Agent
    if [ -n "$SPECIFIC_AGENT" ]; then
        check_node_version
        check_npm_version
        detect_os
        install_to_agent "$SPECIFIC_AGENT"
    else
        # 否则安装到所有检测到的 Agent
        install_all
    fi
}

# 运行主函数
main "$@"

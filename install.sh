#!/bin/bash

# all-in-mvp 技能快速安装脚本
# 
# 使用方法：
#   curl -fsSL https://raw.githubusercontent.com/your-username/all-in-mvp/main/install.sh | bash
#   
#   或者下载后运行：
#   chmod +x install.sh
#   ./install.sh

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
    
    # 使用 npx giget 下载
    if command_exists npx; then
        npx giget github:your-username/all-in-mvp/skills "$target_dir" --force
        print_success "$agent 技能安装完成"
    else
        print_error "未找到 npx，请先安装 npm"
        return 1
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
    echo "  --agent <name>  指定安装到的 Agent (qoder/claude/gemini)"
    echo "  --help          显示此帮助信息"
    echo ""
    echo "示例："
    echo "  # 安装到所有检测到的 Agent"
    echo "  ./install.sh"
    echo ""
    echo "  # 只安装到 Qoder"
    echo "  ./install.sh --agent qoder"
    echo ""
    echo "  # 只安装到 Claude Code"
    echo "  ./install.sh --agent claude"
}

# 主函数
main() {
    # 解析参数
    SPECIFIC_AGENT=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --agent)
                SPECIFIC_AGENT="$2"
                shift 2
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

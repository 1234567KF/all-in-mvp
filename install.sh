#!/bin/bash

# ============================================================
#  all-in-mvp 一键安装脚本（简化版）
# ============================================================
#
#  用法：
#
# ① giget 拉取后本地安装（推荐）：
#    npx giget gh:1234567KF/all-in-mvp#all-in-mvp my-project
#    cd my-project
#    chmod +x install.sh && ./install.sh
#
# ② 当前目录安装（最常用）：
#    npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force && chmod +x install.sh && ./install.sh
#
# ③ 远程一键安装：
#    curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh | bash
#
# 原理：推库前 pre-push hook 已自动同步 skills →
# .claude/skills/ + .qoder/skills/ + .trae/skills/，
# .gitattributes export-ignore 确保 GitHub tarball 自动过滤冗余文件，
# 本脚本只需将已融合的技能复制到全局配置目录。
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error()   { echo -e "${RED}✗ $1${NC}"; }
print_info()    { echo -e "${BLUE}ℹ $1${NC}"; }
print_header()  { echo -e "${CYAN}$1${NC}"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# --- 安装技能到 Agent（从本地目录复制）---
install_skills() {
    local agent=$1
    local src_dir=""
    local dst_dir=""

    case $agent in
        qoder)  src_dir="$SCRIPT_DIR/.qoder/skills";  dst_dir="$HOME/.qoder/skills" ;;
        claude) src_dir="$SCRIPT_DIR/.claude/skills"; dst_dir="$HOME/.claude/skills" ;;
        *) print_error "未知 Agent: $agent"; return 1 ;;
    esac

    print_info "安装 $agent 技能..."

    if [ -d "$src_dir" ]; then
        # 方案 A：本地已有（giget 拉取的项目），直接复制
        mkdir -p "$dst_dir"
        cp -r "$src_dir/"* "$dst_dir/" 2>/dev/null || true
        print_success "$agent 技能已安装 ($dst_dir)"
    else
        # 方案 B：远程模式（curl 管道），用 giget 下载
        if command_exists npx; then
            print_info "从 GitHub 下载 $agent 技能..."
            npx giget "gh:1234567KF/all-in-mvp#all-in-mvp/skills" "$dst_dir" --force \
              --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
            print_success "$agent 技能已安装（远程）"
        else
            print_error "未找到 npx，请先安装 Node.js"
            return 1
        fi
    fi
}

# --- 检测已安装的 AI Agent ---
detect_agents() {
    AGENTS=()
    [ -d "$HOME/.qoder" ]  && AGENTS+=("qoder")  && print_success "检测到 Qoder"
    [ -d "$HOME/.claude" ] && AGENTS+=("claude") && print_success "检测到 Claude Code"
    if [ ${#AGENTS[@]} -eq 0 ]; then
        print_warning "未检测到已安装的 AI Agent"
        print_info "请先安装 Qoder 或 Claude Code"
        exit 1
    fi
}

# --- 帮助 ---
show_help() {
    echo "all-in-mvp 技能安装脚本"
    echo ""
    echo "使用方法："
    echo "  ./install.sh [options]"
    echo ""
    echo "选项："
    echo "  --agent <name>  指定平台 (qoder/claude)"
    echo "  --version       显示版本"
    echo "  --help          帮助"
    echo ""
    echo "示例："
    echo "  # giget 拉取后安装"
    echo "  npx giget gh:1234567KF/all-in-mvp#all-in-mvp my-project"
    echo "  cd my-project && ./install.sh"
    echo ""
    echo "  # 当前目录安装（最常用）"
    echo "  npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force && ./install.sh"
    echo ""
    echo "  # 远程一键安装"
    echo "  curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh | bash"
}

# --- 主函数 ---
main() {
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    SPECIFIC_AGENT=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --agent)   SPECIFIC_AGENT="$2"; shift 2 ;;
            --version) echo "all-in-mvp installer v2.9.0"; exit 0 ;;
            --help)    show_help; exit 0 ;;
            *)         print_error "未知参数: $1"; show_help; exit 1 ;;
        esac
    done

    print_header "============================"
    print_header "  all-in-mvp 技能安装 v2.9.0"
    print_header "============================"
    echo ""

    # 检查 Node.js（giget fallback 需要）
    if ! command_exists node; then
        print_warning "Node.js 未安装（本地复制模式不需要，远程下载需要）"
    fi

    if [ -n "$SPECIFIC_AGENT" ]; then
        install_skills "$SPECIFIC_AGENT"
    else
        detect_agents
        echo ""
        print_header "开始安装技能..."
        echo ""
        for agent in "${AGENTS[@]}"; do
            install_skills "$agent"
            echo ""
        done
    fi

    print_header "========================"
    print_success "安装完成！"
    echo ""
    print_info "使用方式："
    echo "  1. 进入你的项目目录"
    echo "  2. 启动 AI Agent"
    echo "  3. 输入指令激活技能，例如："
    echo "     - 使用 all-in-mvp 创建一个 CRM 系统"
    echo ""
}

main "$@"

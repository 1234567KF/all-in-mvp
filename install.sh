#!/bin/bash

# ============================================================
#  all-in-mvp 项目级技能安装脚本
# ============================================================
#
#  用法：
#
# ① 一行命令（推荐）：
#    npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
#    → .claude/skills/ .qoder/skills/ .trae/skills/ 已在项目根目录
#    → 启动 Qoder / Claude Code 即可使用
#
# ② 验证安装：
#    chmod +x install.sh && ./install.sh
#
# ③ 远程一键安装（下载到当前目录）：
#    curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh | bash
#
# 原理：技能在项目级目录（.claude/.qoder/.trae/skills/），
# Agent 自动识别，优先级高于全局。不污染全局配置。
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

# --- 检测项目级技能目录 ---
check_skills() {
    local missing=0
    echo ""
    print_info "检测项目级技能目录..."

    for dir in ".claude/skills" ".qoder/skills" ".trae/skills"; do
        if [ -d "$SCRIPT_DIR/$dir" ]; then
            local count=$(find "$SCRIPT_DIR/$dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
            print_success "$dir 已就绪（$count 个技能）"
        else
            print_warning "$dir 缺失"
            missing=1
        fi
    done

    return $missing
}

# --- 远程模式：下载技能到当前项目目录 ---
download_skills() {
    if ! command_exists npx; then
        print_error "需要 Node.js / npx，请先安装"
        exit 1
    fi

    print_info "从 GitHub 下载技能到项目目录..."

    for target in ".claude/skills" ".qoder/skills" ".trae/skills"; do
        print_info "下载 $target..."
        npx giget "gh:1234567KF/all-in-mvp#all-in-mvp/$target" "$SCRIPT_DIR/$target" --force
        print_success "$target 下载完成"
    done
}

# --- 检测已安装的 AI Agent ---
detect_agents() {
    AGENTS=()
    [ -d "$HOME/.qoder" ]  && AGENTS+=("qoder")  && print_success "检测到 Qoder"
    [ -d "$HOME/.claude" ] && AGENTS+=("claude") && print_success "检测到 Claude Code"
    if [ ${#AGENTS[@]} -eq 0 ]; then
        print_warning "未检测到已安装的 AI Agent"
        print_info "技能已在项目目录，安装 Agent 后即可使用"
    fi
}

# --- 帮助 ---
show_help() {
    echo "all-in-mvp 项目级技能安装"
    echo ""
    echo "技能放在项目根目录 .claude/skills/ .qoder/skills/ .trae/skills/"
    echo "Agent 自动识别，项目级优先，不污染全局。"
    echo ""
    echo "一行命令："
    echo "  npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force"
}

# --- 主函数 ---
main() {
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --version) echo "all-in-mvp installer v2.9.1"; exit 0 ;;
            --help)    show_help; exit 0 ;;
            *)         print_error "未知参数: $1"; show_help; exit 1 ;;
        esac
    done

    print_header "============================"
    print_header "  all-in-mvp 项目级技能 v2.9.1"
    print_header "============================"

    # 检测技能是否已存在
    if check_skills; then
        echo ""
        print_success "所有技能已就绪！"
    else
        # 缺失则下载
        print_info "下载缺失的技能到项目目录..."
        download_skills
        echo ""
        check_skills
    fi

    echo ""
    detect_agents
    echo ""
    print_header "========================"
    print_success "完成！"
    echo ""
    print_info "技能目录（项目级）："
    echo "  .claude/skills/  .qoder/skills/  .trae/skills/"
    echo ""
    print_info "使用方法："
    echo "  在本项目目录启动 Qoder / Claude Code"
    echo "  输入：使用 all-in-mvp 创建一个 CRM 系统"
    echo ""
}

main "$@"


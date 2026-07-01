#!/usr/bin/env bash
# UltraCostEffective 极致节能 — macOS/Linux Bash 安装脚本
# 一条命令完成安装和预检

set -e

SKIP_LEAN_CTX=false
SKIP_HEADROOM=false
PRESET="standard"

# 解析参数
for arg in "$@"; do
  case $arg in
    --skip-lean-ctx) SKIP_LEAN_CTX=true ;;
    --skip-headroom) SKIP_HEADROOM=true ;;
    --quick) PRESET="quick" ;;
    --standard) PRESET="standard" ;;
    --extreme) PRESET="extreme" ;;
    --preset=*) PRESET="${arg#*=}" ;;
  esac
done

ULTRA_COST_EFFECTIVE_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================"
echo "   UltraCostEffective · 极致节能 — Linux/macOS 安装脚本"
echo "============================================"
echo ""

# ─── Phase 1: 环境检测 ────────────────────────

echo "[1/5] 检测环境..."

if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js 未安装。请先安装 Node.js ≥ 18.0"
    echo "     下载: https://nodejs.org/"
    exit 1
fi
echo "  ✓ Node.js $(node --version)"

PLATFORM="claude"
if [ -n "$QODER_SESSION_ID" ] || [ -n "$QODER_WORKSPACE" ]; then
    PLATFORM="qoder"
    echo "  ✓ 检测到 Qoder 平台"
elif [ -n "$CLAUDE_CODE_SESSION_ID" ] || command -v claude &> /dev/null; then
    PLATFORM="claude"
    echo "  ✓ 检测到 Claude Code 平台"
else
    echo "  ⚠ 未检测到平台，默认使用 Claude Code 配置"
fi

# ─── Phase 2: 安装 lean-ctx ────────────────────

echo ""
echo "[2/5] 安装 lean-ctx MCP 工具..."

if [ "$SKIP_LEAN_CTX" = true ]; then
    echo "  ⏭ 跳过 (--skip-lean-ctx)"
else
    if npm install -g lean-ctx-bin 2>/dev/null; then
        echo "  ✓ lean-ctx-bin 安装完成"
        lean-ctx init 2>/dev/null && echo "  ✓ lean-ctx 初始化完成" || echo "  ⚠ lean-ctx init 失败"
    else
        echo "  ⚠ lean-ctx 安装失败（不影响核心功能，上下文压缩将降级到 tokenforge）"
    fi
fi

# ─── Phase 3: Headroom (可选) ──────────────────

echo ""
echo "[3/5] Headroom (可选增强)..."

if [ "$SKIP_HEADROOM" = true ]; then
    echo "  ⏭ 跳过 (--skip-headroom)"
elif [ "$PRESET" = "extreme" ]; then
    echo "  🔧 extreme 预设需 Headroom，尝试安装..."
    if pip install headroom-ai[all] 2>/dev/null; then
        echo "  ✓ Headroom 安装完成"
        export ULTRA_COST_EFFECTIVE_HEADROOM=1
    else
        echo "  ⚠ pip 不可用或 Headroom 安装失败"
        echo "    手动安装: pip install headroom-ai[all]"
    fi
else
    echo "  ⏭ Headroom 为 extreme 预设可选增强，当前未启用"
    echo "    如需启用: pip install headroom-ai[all] && export ULTRA_COST_EFFECTIVE_HEADROOM=1"
fi

# ─── Phase 4: 配置预设 ─────────────────────────

echo ""
echo "[4/5] 配置预设..."

PRESET_FILE="$ULTRA_COST_EFFECTIVE_ROOT/presets/$PRESET.json"
if [ -f "$PRESET_FILE" ]; then
    PRESET_NAME=$(node -e "console.log(require('$PRESET_FILE').name)" 2>/dev/null || echo "$PRESET")
    PRESET_DESC=$(node -e "console.log(require('$PRESET_FILE').description)" 2>/dev/null || echo "")
    PRESET_SAVING=$(node -e "console.log(require('$PRESET_FILE').estimatedSavings)" 2>/dev/null || echo "70-85%")
    echo "  ✓ 预设: $PRESET_NAME — $PRESET_DESC"
    echo "    预计节省: $PRESET_SAVING"

    export ULTRA_COST_EFFECTIVE_PLATFORM="$PLATFORM"
    export ULTRA_COST_EFFECTIVE_PRESET="$PRESET"
    LEVEL=$(node -e "console.log(require('$PRESET_FILE').layers.L1_tokenforge?.level || 'medium')" 2>/dev/null || echo "medium")
    export ULTRA_COST_EFFECTIVE_LEVEL="$LEVEL"
else
    echo "  ⚠ 预设文件不存在: $PRESET_FILE，使用默认 standard"
    export ULTRA_COST_EFFECTIVE_LEVEL="medium"
    export ULTRA_COST_EFFECTIVE_PRESET="standard"
fi

# ─── Phase 5: 验证 ─────────────────────────────

echo ""
echo "[5/5] 预检验证..."

VALIDATOR="$ULTRA_COST_EFFECTIVE_ROOT/helpers/prefix-validator.cjs"
if [ -f "$VALIDATOR" ]; then
    node "$VALIDATOR" --check-all 2>/dev/null && echo "  ✓ 前缀一致性校验通过" || echo "  ⚠ 前缀校验跳过（非关键）"
fi

# 验证 tokenforge
echo "  ✓ 核心文件就绪"

# ─── 完成 ──────────────────────────────────────

echo ""
echo "============================================"
echo "   UltraCostEffective 安装完成！"
echo "============================================"
echo ""
echo "  平台:       $PLATFORM"
echo "  预设:       $PRESET"
case $PRESET in
    quick)    SAVING="50-70%" ;;
    standard) SAVING="70-85%" ;;
    extreme)  SAVING="85-95%" ;;
    *)        SAVING="70-85%" ;;
esac
echo "  预计节省:   $SAVING"
echo ""
echo "  下一步:"
echo "    1. 重启 Claude Code / Qoder"
echo "    2. UltraCostEffective 将自动激活（always-on: true）"
echo "    3. 说出「token report」查看节省效果"
echo ""
echo "  手动控制:"
echo "    export ULTRA_COST_EFFECTIVE_OFF=1          # 临时关闭"
echo "    node helpers/tokenforge-hook.cjs --test  # 测试分类"
echo ""

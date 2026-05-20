#!/usr/bin/env bash
# ============================================================
# all-in-skills 跨平台技能生成脚本 (Bash/Shell)
#
# 源: skills/ (唯一维护点)
# 产出: .qoder/ + .claude/skills/ + .trae/skills/
# 差异: overlays/<平台>/  (按需覆盖)
#
# 兼容: macOS / Linux / Windows (Git Bash / WSL)
# 维护者运行一次，产物提交 Git。用户 clone 后零脚本直接用。
# ============================================================

set -e

# ---- 颜色 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; GRAY='\033[0;90m'; NC='\033[0m'

# ---- 路径 ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/skills"
OVERLAYS_DIR="$REPO_ROOT/overlays"
DRY_RUN=false

# ---- 目标平台配置 ----
# 格式: "平台名|目标相对路径|覆盖层目录名"
PLATFORMS=(
  "qoder|.qoder/skills|qoder"
  "claude-code|.claude/skills|claude-code"
  "trae|.trae/skills|trae"
)

# 非技能目录（跳过）
SKIP_ITEMS=("README.md" "references" ".gitkeep")

# ---- 参数 ----
for arg in "$@"; do
  case $arg in --dry-run|-n) DRY_RUN=true ;; --clean|-c) CLEAN=true ;; esac
done

# ---- 函数 ----
msg_step()  { echo -e "  ${CYAN}$1${NC}"; }
msg_ok()    { echo -e "  ${GREEN}✅ $1${NC}"; }
msg_warn()  { echo -e "  ${YELLOW}⚠ $1${NC}"; }

is_skill() { [ -f "$1/SKILL.md" ]; }

get_skill_names() {
  local names=()
  for dir in "$SOURCE_DIR"/*/; do
    local name; name=$(basename "$dir")
    for skip in "${SKIP_ITEMS[@]}"; do
      [[ "$name" == "$skip" ]] && continue 2
    done
    is_skill "$SOURCE_DIR/$name" && names+=("$name")
  done
  echo "${names[@]}"
}

copy_dir() {
  local src="$1" dst="$2" dry="$3"
  [ "$dry" = true ] && { msg_step "[DRY RUN] sync: $src -> $dst"; return; }
  mkdir -p "$dst"
  if command -v rsync &>/dev/null; then
    rsync -a --update "$src/" "$dst/" 2>/dev/null
  else
    cp -R "$src"/* "$dst/" 2>/dev/null
  fi
}

remove_orphans() {
  local target="$1"; shift; local names=("$@"); local dry="${@: -1}"
  [ ! -d "$target" ] && return
  for dir in "$target"/*/; do
    local name; name=$(basename "$dir")
    [ "$name" = "references" ] && continue
    local found=false
    for n in "${names[@]}"; do [[ "$n" == "$name" ]] && found=true && break; done
    if [ "$found" = false ]; then
      if [ "$dry" = true ]; then msg_warn "[DRY RUN] orphan: $dir"
      else msg_warn "orphan: $dir"; rm -rf "$dir"; fi
    fi
  done
}

# ---- 主流程 ----
echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  all-in-skills 跨平台技能生成${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo -e "  源:   skills/"
echo -e "  差异: overlays/<平台>/"
echo -e "  产出: .qoder/skills/ .claude/skills/ .trae/skills/"
echo ""

[ "$DRY_RUN" = true ] && { msg_warn "DRY RUN mode"; echo ""; }
[ ! -d "$SOURCE_DIR" ] && { echo -e "${RED}Source missing: $SOURCE_DIR${NC}"; exit 1; }
[ ! -d "$OVERLAYS_DIR" ] && { echo -e "${RED}Overlays missing: $OVERLAYS_DIR${NC}"; exit 1; }

IFS=' ' read -ra SKILL_NAMES <<< "$(get_skill_names)"
echo -e "${CYAN}Skills: ${#SKILL_NAMES[@]}${NC}"
echo -e "  ${GRAY}$(IFS=', '; echo "${SKILL_NAMES[*]}")${NC}"
echo ""

for platform_config in "${PLATFORMS[@]}"; do
  IFS='|' read -r PLATFORM_NAME TARGET_REL OVERLAY_NAME <<< "$platform_config"
  TARGET_DIR="$REPO_ROOT/$TARGET_REL"
  OVERLAY_DIR="$OVERLAYS_DIR/$OVERLAY_NAME"

  echo -e "${YELLOW}--- ${PLATFORM_NAME} -> ${TARGET_REL} ---${NC}"

  [ "${CLEAN:-false}" = true ] && [ -d "$TARGET_DIR" ] && {
    msg_warn "clean target"; [ "$DRY_RUN" = false ] && rm -rf "$TARGET_DIR"
  }
  [ "$DRY_RUN" = false ] && mkdir -p "$TARGET_DIR"

  COPY_COUNT=0; OVERLAY_COUNT=0

  for skill_name in "${SKILL_NAMES[@]}"; do
    SRC_SKILL_DIR="$SOURCE_DIR/$skill_name"
    DST_SKILL_DIR="$TARGET_DIR/$skill_name"
    OVL_SKILL_FILE="$OVERLAY_DIR/$skill_name/SKILL.md"

    if [ -f "$OVL_SKILL_FILE" ]; then
      msg_ok "overlay: $skill_name"
      copy_dir "$OVERLAY_DIR/$skill_name" "$DST_SKILL_DIR" "$DRY_RUN"
      OVERLAY_COUNT=$((OVERLAY_COUNT + 1))
      COPY_COUNT=$((COPY_COUNT + 1))
    elif [ -d "$SRC_SKILL_DIR" ]; then
      msg_step "copy:   $skill_name"
      copy_dir "$SRC_SKILL_DIR" "$DST_SKILL_DIR" "$DRY_RUN"
      COPY_COUNT=$((COPY_COUNT + 1))
    fi
  done

  # shared references
  SHARED_REF_SRC="$SOURCE_DIR/references"
  SHARED_REF_DST="$TARGET_DIR/references"
  if [ -d "$SHARED_REF_SRC" ]; then
    msg_step "copy shared references/"
    copy_dir "$SHARED_REF_SRC" "$SHARED_REF_DST" "$DRY_RUN"
  fi

  remove_orphans "$TARGET_DIR" "${SKILL_NAMES[@]}" "$DRY_RUN"
  echo -e "  ${GREEN}done: $COPY_COUNT skills ($OVERLAY_COUNT overlays)${NC}"
  echo ""
done

# ---- 统计 ----
echo -e "${MAGENTA}========================================${NC}"
echo -e "${GREEN}  Generate complete${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo ""
for platform_config in "${PLATFORMS[@]}"; do
  IFS='|' read -r PLATFORM_NAME TARGET_REL _ <<< "$platform_config"
  TARGET_DIR="$REPO_ROOT/$TARGET_REL"
  if [ -d "$TARGET_DIR" ]; then
    count=$(ls -1d "$TARGET_DIR"/*/ 2>/dev/null | grep -v '/references/$' | wc -l | tr -d ' ')
    echo -e "  ${TARGET_REL}/  ->  ${count} skills"
  fi
done
echo ""

[ "$DRY_RUN" = true ] && msg_warn "DRY RUN — use without --dry-run to execute"

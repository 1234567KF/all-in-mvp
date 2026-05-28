<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="toolbar-btn" title="打开文件" @click="onOpen">
        <span class="icon">📂</span> 打开
      </button>
      <button class="toolbar-btn" title="刷新" @click="onRefresh">
        <span class="icon">🔄</span>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editMode }"
        title="编辑模式"
        @click="onEditToggle"
      >
        <span class="icon">✏️</span> 编辑
      </button>
      <div class="dropdown-wrap" ref="insertDropdownRef">
        <button class="toolbar-btn" @click.stop="showInsertMenu = !showInsertMenu">
          <span class="icon">➕</span> 新增 <span style="font-size: 10px">▼</span>
        </button>
        <div class="dropdown-menu" v-show="showInsertMenu">
          <div
            v-for="item in insertItems"
            :key="item.level"
            class="dropdown-item"
            @click="onInsertClick(item.level)"
          >
            <span class="h-icon" :class="'lv' + (item.level || 7)">{{ item.label }}</span>
            {{ item.text }}
          </div>
        </div>
      </div>
    </div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        :class="{ active: viewMode === 'flow' }"
        title="流式视图"
        @click="onFlowView"
      >
        <span class="icon">📝</span> 流式
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: viewMode === 'card' }"
        title="卡片嵌套视图"
        @click="onCardView"
      >
        <span class="icon">🃏</span> 卡片
      </button>
    </div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        :class="{ active: diffVisible }"
        title="显示/隐藏修订"
        @click="onDiffToggle"
      >
        <span class="icon">{{ diffVisible ? '👁️' : '👁️‍🗨️' }}</span>
        {{ diffVisible ? '显示修订' : '隐藏修订' }}
      </button>
      <button class="toolbar-btn" title="全部接受" @click="onAcceptAllClick">
        <span class="icon">✅</span> 全接受
      </button>
      <button class="toolbar-btn" title="全部拒绝" @click="onRejectAllClick">
        <span class="icon">❌</span> 全拒绝
      </button>
    </div>

    <div class="toolbar-group" style="margin-left: auto">
      <div class="dropdown-wrap" ref="baseDropdownRef">
        <button class="toolbar-btn" @click.stop="showBaseMenu = !showBaseMenu">
          <span class="icon">📌</span> 基准 <span style="font-size: 10px">▼</span>
        </button>
        <div class="dropdown-menu" v-show="showBaseMenu">
          <div class="dropdown-item" @click="onBaseClick('set')">设为基准 (V0)</div>
          <div class="dropdown-item" @click="onBaseClick('clear')">清除基准</div>
        </div>
      </div>
      <button
        class="toolbar-btn"
        :class="{ active: darkMode }"
        title="切换暗色/亮色主题"
        @click="onDarkToggle"
      >
        <span class="icon">{{ darkMode ? '☀️' : '🌙' }}</span>
      </button>
      <button class="toolbar-btn" title="导出 DOCX" @click="onExportClick">
        <span class="icon">📥</span> 导出
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

defineProps<{
  viewMode: 'card' | 'flow';
  diffVisible: boolean;
  editMode: boolean;
  darkMode: boolean;
  hasBase: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleView', mode: 'card' | 'flow'): void;
  (e: 'toggleDiff'): void;
  (e: 'toggleEdit'): void;
  (e: 'toggleDark'): void;
  (e: 'insert', level: number): void;
  (e: 'acceptAll'): void;
  (e: 'rejectAll'): void;
  (e: 'export'): void;
  (e: 'setBase'): void;
  (e: 'clearBase'): void;
  (e: 'open'): void;
  (e: 'refresh'): void;
}>();

const showInsertMenu = ref(false);
const showBaseMenu = ref(false);
const insertDropdownRef = ref<HTMLElement | null>(null);
const baseDropdownRef = ref<HTMLElement | null>(null);

const insertItems = [
  { level: 1, label: 'H1', text: '一级标题' },
  { level: 2, label: 'H2', text: '二级标题' },
  { level: 3, label: 'H3', text: '三级标题' },
  { level: 4, label: 'H4', text: '四级标题' },
  { level: 5, label: 'H5', text: '五级标题' },
  { level: 6, label: 'H6', text: '六级标题' },
  { level: 0, label: '¶', text: '正文段落' },
];

// --- Named handlers for all buttons ---
function onOpen() { emit('open'); }
function onRefresh() { emit('refresh'); }
function onEditToggle() { emit('toggleEdit'); }
function onFlowView() { emit('toggleView', 'flow'); }
function onCardView() { emit('toggleView', 'card'); }
function onDiffToggle() { emit('toggleDiff'); }
function onAcceptAllClick() { emit('acceptAll'); }
function onRejectAllClick() { emit('rejectAll'); }
function onDarkToggle() { emit('toggleDark'); }
function onExportClick() { emit('export'); }

function onInsertClick(level: number) {
  emit('insert', level);
  showInsertMenu.value = false;
}

function onBaseClick(action: 'set' | 'clear') {
  if (action === 'set') emit('setBase');
  else emit('clearBase');
  showBaseMenu.value = false;
}

// Click-outside handler for dropdowns only (not interfering with button clicks)
function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (insertDropdownRef.value && !insertDropdownRef.value.contains(target)) {
    showInsertMenu.value = false;
  }
  if (baseDropdownRef.value && !baseDropdownRef.value.contains(target)) {
    showBaseMenu.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.toolbar {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  background: var(--background);
  border-bottom: 1px solid var(--border);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-group + .toolbar-group {
  margin-left: 4px;
  border-left: 1px solid var(--border);
  padding-left: 4px;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  gap: 4px;
  transition: background 150ms ease-in-out;
  white-space: nowrap;
  font-family: var(--font-sans);
}

.toolbar-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.toolbar-btn.active {
  background: var(--accent);
  color: var(--foreground);
}

.toolbar-btn .icon {
  font-size: 15px;
  line-height: 1;
}

.dropdown-wrap {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  z-index: 100;
  padding: 4px;
  margin-top: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--foreground);
}

.dropdown-item:hover {
  background: var(--accent);
}

.h-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  font-size: 9px;
  width: 22px;
  height: 22px;
  border: 1.5px solid;
  flex-shrink: 0;
}

.h-icon.lv1 { background: #1D4ED8; border-color: #3B82F6; color: #FFF; }
.h-icon.lv2 { background: #059669; border-color: #34D399; color: #FFF; }
.h-icon.lv3 { background: #D97706; border-color: #FBBF24; color: #FFF; }
.h-icon.lv4 { background: #7C3AED; border-color: #A78BFA; color: #FFF; }
.h-icon.lv5 { background: #BE185D; border-color: #F472B6; color: #FFF; }
.h-icon.lv6 { background: #78716C; border-color: #A8A29E; color: #FFF; }
.h-icon.lv7 { background: #6366F1; border-color: #818CF8; color: #FFF; }
</style>

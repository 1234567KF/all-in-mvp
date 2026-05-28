<template>
  <div class="app-wrapper">
    <Toolbar
      :viewMode="ui.viewMode"
      :diffVisible="ui.diffVisible"
      :editMode="ui.editMode"
      :darkMode="ui.darkMode"
      :hasBase="doc.hasBaseVersion"
      @open="onOpen"
      @refresh="onRefresh"
      @toggleView="onToggleView"
      @toggleDiff="onToggleDiff"
      @toggleEdit="onToggleEdit"
      @toggleDark="onToggleDark"
      @insert="onInsert"
      @acceptAll="onAcceptAll"
      @rejectAll="onRejectAll"
      @export="onExport"
      @setBase="onSetBase"
      @clearBase="onClearBase"
    />
    <div class="main-area">
      <div
        ref="outlinePanelRef"
        class="outline-panel"
        :class="{ collapsed: ui.outlineCollapsed }"
        :style="{ width: ui.outlineCollapsed ? '36px' : ui.outlineWidth + 'px' }"
      >
        <div class="panel-header">
          <span v-show="!ui.outlineCollapsed" class="panel-title">大纲导航</span>
          <button class="collapse-btn" @click="ui.toggleOutline()" :title="ui.outlineCollapsed ? '展开大纲' : '折叠大纲'">
            {{ ui.outlineCollapsed ? '▶' : '◀' }}
          </button>
        </div>
        <div v-show="!ui.outlineCollapsed" class="outline-content">
          <OutlineSearch v-model="ui.searchQuery" />
          <div class="outline-tree">
            <OutlineNode
              v-for="h in doc.headings"
              :key="h.id"
              :heading="h"
              :level="1"
              :activeId="ui.activeHeadingId"
              :searchQuery="ui.searchQuery"
              @navigate="onNavigate"
              @reorder="onReorder"
            />
          </div>
        </div>
        <span v-if="ui.outlineCollapsed" class="expand-label">大纲</span>
      </div>

      <div ref="leftDividerRef" class="panel-divider" />

      <ContentPanel :viewMode="ui.viewMode" :diffVisible="ui.diffVisible" :editMode="ui.editMode" />

      <div ref="rightDividerRef" class="panel-divider" />

      <div
        ref="revisionPanelRef"
        class="revision-panel"
        :class="{ collapsed: ui.revisionCollapsed }"
        :style="{ width: ui.revisionCollapsed ? '36px' : ui.revisionWidth + 'px' }"
      >
        <div class="panel-header">
          <span v-show="!ui.revisionCollapsed" class="panel-title">修订历史</span>
          <button class="collapse-btn" @click="ui.toggleRevision()" :title="ui.revisionCollapsed ? '展开修订' : '折叠修订'">
            {{ ui.revisionCollapsed ? '◀' : '▶' }}
          </button>
        </div>
        <RevisionPanel
          v-show="!ui.revisionCollapsed"
          @navigate="onRevisionNavigate"
          @rollback="onRollback"
          @exportWithRevisions="onExportWithRevisions"
        />
        <span v-if="ui.revisionCollapsed" class="expand-label">修订</span>
      </div>
    </div>
    <StatusBar />

    <!-- Toast -->
    <div v-if="ui.toast" class="toast-container">
      <div class="toast-msg">{{ ui.toast }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useDocumentStore } from './stores/documentStore';
import { useUiStore } from './stores/uiStore';
import { useVscodeApi } from './composables/useVscodeApi';
import { usePanelResize } from './composables/usePanelResize';
import Toolbar from './components/layout/Toolbar.vue';
import StatusBar from './components/layout/StatusBar.vue';
import OutlineSearch from './components/outline/OutlineSearch.vue';
import OutlineNode from './components/outline/OutlineNode.vue';
import ContentPanel from './components/content/ContentPanel.vue';
import RevisionPanel from './components/revision/RevisionPanel.vue';
import type { VsMessage, DocumentLoadedPayload, DiffResultPayload, RevisionUpdatedPayload, BaseVersion } from './types/index';
import { demoHeadings, demoContent, demoRevisions, demoBodies, demoDiffChanges } from './demo-data';

const doc = useDocumentStore();
const ui = useUiStore();
const { postMessage, onMessage } = useVscodeApi();

const outlinePanelRef = ref<HTMLElement | null>(null);
const leftDividerRef = ref<HTMLElement | null>(null);
const revisionPanelRef = ref<HTMLElement | null>(null);
const rightDividerRef = ref<HTMLElement | null>(null);

usePanelResize(
  () => outlinePanelRef.value,
  () => leftDividerRef.value,
  'left',
  ui.outlineWidth,
  ui.outlineCollapsed
);
usePanelResize(
  () => revisionPanelRef.value,
  () => rightDividerRef.value,
  'right',
  ui.revisionWidth,
  ui.revisionCollapsed
);

let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = onMessage((msg: VsMessage) => {
    switch (msg.type) {
      case 'document:loaded': {
        const p = msg.payload as DocumentLoadedPayload;
        doc.setContent(p.content);
        doc.setHeadings(p.headings);
        doc.setRevisions(p.revisionStore.revisions, p.revisionStore.baseVersion);
        if (p.revisionStore.baseVersion) {
          postMessage('document:requestDiff', { v0: p.revisionStore.baseVersion.content, v1: p.content });
        }
        break;
      }
      case 'document:changed': {
        const p = msg.payload as { content: string; headings: any[] };
        doc.setContent(p.content);
        doc.setHeadings(p.headings);
        if (doc.baseVersion) {
          postMessage('document:requestDiff', { v0: doc.baseVersion.content, v1: p.content });
        }
        break;
      }
      case 'diff:result': {
        const p = msg.payload as DiffResultPayload;
        doc.setDiffResult(p.changes, p.stats);
        break;
      }
      case 'revision:updated': {
        const p = msg.payload as RevisionUpdatedPayload;
        doc.setRevisions(p.revisions, p.baseVersion);
        break;
      }
    }
  });
  postMessage('ui:ready');
});

onUnmounted(() => { unsubscribe?.(); });

function onOpen() {
  const isStandalone = typeof (window as any).acquireVsCodeApi === 'undefined';
  if (isStandalone) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      doc.setContent(text);
      const lines = text.split('\n');
      const headings: any[] = [];
      const stack: any[] = [headings];
      for (const line of lines) {
        const m = line.match(/^(#{1,6})\s+(.+)/);
        if (m) {
          const level = m[1].length;
          const heading = { id: m[2].toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-'), level, text: m[2], children: [] };
          while (stack.length > level) stack.pop();
          stack[stack.length - 1].push(heading);
          stack.push(heading.children);
        }
      }
      doc.setHeadings(headings);
      (window as any).__demoBodies = {};
      ui.showToast(`已打开: ${file.name}`);
    };
    input.click();
  } else {
    postMessage('document:open');
    ui.showToast('打开文件...');
  }
}

function onRefresh() {
  const isStandalone = typeof (window as any).acquireVsCodeApi === 'undefined';
  if (isStandalone) {
    doc.setContent(demoContent);
    doc.setHeadings(demoHeadings);
    doc.setRevisions(demoRevisions, null);
    doc.setDiffResult(demoDiffChanges, { inserted: 140, deleted: 48, modified: 6 });
    (window as any).__demoBodies = demoBodies;
    ui.showToast('已刷新到初始状态');
  } else {
    postMessage('ui:ready');
    ui.showToast('已请求刷新...');
  }
}

function onToggleView(mode: 'card' | 'flow') {
  ui.setViewMode(mode);
  ui.showToast(`已切换到${mode === 'card' ? '卡片嵌套' : '流式'}视图`);
}

function onToggleDiff() {
  ui.toggleDiffVisible();
  ui.showToast(ui.diffVisible ? '修订标记已显示' : '修订标记已隐藏');
}

function onToggleEdit() {
  ui.toggleEditMode();
  ui.showToast(ui.editMode ? '编辑模式已开启 — 点击标题即可编辑' : '编辑模式已关闭');
}

function onToggleDark() {
  ui.toggleDarkMode();
  ui.showToast(ui.darkMode ? '暗色主题' : '亮色主题');
}

function onInsert(level: number) {
  const label = level === 0 ? '正文段落' : `H${level} 标题`;
  // Auto-select first heading if none is active
  if (!ui.activeHeadingId && doc.headings.length > 0) {
    ui.setActiveHeading(doc.headings[0].id);
  }
  window.dispatchEvent(new CustomEvent('mdw:insert', { detail: { level } }));
  postMessage('document:insert', { level });
  ui.showToast(`已插入 ${label}`);
}

function onAcceptAll() {
  // DOM-level: keep inserted/modified text, remove deleted text, strip all diff markers
  const cardBodies = document.querySelectorAll('.card-body');
  cardBodies.forEach(body => {
    // Remove deleted content entirely
    body.querySelectorAll('.diff-delete').forEach(el => el.remove());
    // Keep inserted/modified text but remove the marker class
    body.querySelectorAll('.diff-insert, .diff-modify').forEach(el => {
      el.removeAttribute('class');
    });
  });
  doc.acceptAllChanges();
  postMessage('revision:acceptAll');
  ui.showToast('已接受所有变更');
}

function onRejectAll() {
  // DOM-level: keep deleted text (restore), remove inserted/modified text
  const cardBodies = document.querySelectorAll('.card-body');
  cardBodies.forEach(body => {
    // Remove inserted content (new additions go away)
    body.querySelectorAll('.diff-insert').forEach(el => el.remove());
    // Restore deleted text (remove the class, text stays), restore modified to original
    body.querySelectorAll('.diff-delete').forEach(el => {
      el.removeAttribute('class');
    });
    body.querySelectorAll('.diff-modify').forEach(el => {
      el.removeAttribute('class');
    });
  });
  doc.rejectAllChanges();
  postMessage('revision:rejectAll');
  ui.showToast('已拒绝所有变更');
}

function onExport() {
  postMessage('document:export');
  ui.showToast('导出功能仅在 VS Code 插件中可用');
}

function onSetBase() {
  const bv: BaseVersion = { content: doc.content, markedAt: new Date().toISOString(), filePath: 'demo.md' };
  doc.setBaseVersionLocal(bv);
  postMessage('revision:setBase', { content: doc.content });
  ui.showToast('已设为基准版本 (V0)');
}

function onClearBase() {
  doc.clearBaseVersionLocal();
  postMessage('revision:clearBase');
  ui.showToast('已清除基准版本');
}

function onRollback() {
  // DOM-level: same as reject — restore to original
  const cardBodies = document.querySelectorAll('.card-body');
  cardBodies.forEach(body => {
    body.querySelectorAll('.diff-insert').forEach(el => el.remove());
    body.querySelectorAll('.diff-delete, .diff-modify').forEach(el => {
      el.removeAttribute('class');
    });
  });
  doc.rejectAllChanges();
  postMessage('revision:rollback');
  ui.showToast('已回退到初始版本');
}

function onExportWithRevisions() {
  postMessage('document:export', { withRevisions: true });
  ui.showToast('导出功能仅在 VS Code 插件中可用');
}

function onRevisionNavigate(headingId: string) {
  onNavigate(headingId);
}

function onReorder(payload: { draggedId: string; targetId: string }) {
  postMessage('document:reorder', payload);
  ui.showToast(`已移动章节 "${payload.draggedId}" → "${payload.targetId}" 之前`);
}

function onNavigate(headingId: string) {
  ui.setActiveHeading(headingId);
  const el = document.getElementById(headingId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.style.transition = 'box-shadow 300ms ease';
    el.style.boxShadow = '0 0 0 3px var(--ring), 0 4px 12px rgb(0 0 0 / 0.15)';
    setTimeout(() => { el.style.boxShadow = ''; }, 2000);
  }
}
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.outline-panel,
.revision-panel {
  display: flex;
  flex-direction: column;
  background: var(--muted);
  position: relative;
  transition: width 200ms ease-in-out;
  overflow: hidden;
}

.outline-panel { border-right: 1px solid var(--border); }
.revision-panel { border-left: 1px solid var(--border); }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  min-height: 36px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.expand-label {
  writing-mode: vertical-rl;
  font-size: 11px;
  color: var(--muted-foreground);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  letter-spacing: 0.05em;
}

.outline-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

.outline-tree {
  flex: 1;
  overflow-y: auto;
}

.panel-divider {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  flex-shrink: 0;
  z-index: 5;
}

.panel-divider:hover {
  background: color-mix(in srgb, var(--ring) 30%, transparent);
}

.panel-divider::after {
  content: '';
  position: absolute;
  left: 1.5px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}

.panel-divider:hover::after {
  background: var(--ring);
}
</style>

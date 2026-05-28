<template>
  <div class="revision-content">
    <div class="revision-tabs">
      <button
        class="revision-tab"
        :class="{ active: activeTab === 'timeline' }"
        @click="activeTab = 'timeline'"
      >时间线</button>
      <button
        class="revision-tab"
        :class="{ active: activeTab === 'overview' }"
        @click="activeTab = 'overview'"
      >概览</button>
    </div>

    <!-- Timeline -->
    <div v-show="activeTab === 'timeline'" class="revision-timeline">
      <div
        v-for="rev in doc.revisions"
        :key="rev.id"
        class="revision-entry"
        :class="{ active: selectedRevId === rev.id }"
        @click="onSelectRev(rev)"
      >
        <div class="entry-time">{{ formatTime(rev.timestamp) }}</div>
        <span class="entry-label" :class="rev.triggerer">{{ rev.triggerer === 'ai' ? 'AI' : '人工' }}</span>
        <div class="entry-stats">
          <span class="ins">+{{ rev.stats.inserted }}</span>
          <span class="del">-{{ rev.stats.deleted }}</span>
          <span v-if="rev.stats.modified > 0" class="mod">~{{ rev.stats.modified }}</span>
        </div>
        <div class="entry-actions">
          <button class="mini-btn accept" title="接受此修订" @click.stop="onAcceptRev(rev)">+</button>
          <button class="mini-btn reject" title="拒绝此修订" @click.stop="onRejectRev(rev)">-</button>
        </div>
      </div>
      <div v-if="doc.revisions.length === 0" class="empty-revisions">
        暂无修订记录
      </div>
    </div>

    <!-- Overview -->
    <div v-show="activeTab === 'overview'" class="revision-overview">
      <div class="overview-stats">
        <div class="stat-label">累计变更</div>
        <div class="stat-values">
          <span>新增 <span class="ins">+{{ totalStats.inserted }}</span></span>
          <span>删除 <span class="del">-{{ totalStats.deleted }}</span></span>
          <span>修改 <span class="mod">~{{ totalStats.modified }}</span></span>
        </div>
      </div>
      <div class="overview-stats">
        <div class="stat-label">本次 Diff</div>
        <div class="stat-values">
          <span>新增 <span class="ins">+{{ doc.diffStats.inserted }}</span></span>
          <span>删除 <span class="del">-{{ doc.diffStats.deleted }}</span></span>
          <span>修改 <span class="mod">~{{ doc.diffStats.modified }}</span></span>
        </div>
      </div>
      <div class="overview-meta">
        <div>修订次数: {{ doc.revisions.length }}</div>
        <div>基准版本: {{ doc.hasBaseVersion ? '已设定' : '未设定' }}</div>
      </div>
    </div>

    <div class="revision-actions">
      <button class="action-btn" @click="$emit('rollback')">
        <span class="icon">↩️</span> 回退到初始版本
      </button>
      <button class="action-btn" @click="$emit('exportWithRevisions')">
        <span class="icon">📥</span> 导出带修订 DOCX
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDocumentStore } from '../../stores/documentStore';
import { useUiStore } from '../../stores/uiStore';
import type { Revision } from '../../types/index';

const doc = useDocumentStore();
const ui = useUiStore();

const emit = defineEmits<{
  (e: 'navigate', headingId: string): void;
  (e: 'rollback'): void;
  (e: 'exportWithRevisions'): void;
}>();

const activeTab = ref<'timeline' | 'overview'>('timeline');
const selectedRevId = ref<string | null>(null);

const totalStats = computed(() => {
  return doc.revisions.reduce(
    (acc, r) => ({
      inserted: acc.inserted + r.stats.inserted,
      deleted: acc.deleted + r.stats.deleted,
      modified: acc.modified + r.stats.modified,
    }),
    { inserted: 0, deleted: 0, modified: 0 }
  );
});

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function onSelectRev(rev: Revision) {
  selectedRevId.value = selectedRevId.value === rev.id ? null : rev.id;
  // P1: Timeline↔Diff linkage — scroll to first affected heading if available
  if (rev.changes.length > 0) {
    emit('navigate', rev.changes[0].position?.sectionId || rev.changes[0].id);
  }
}

function onAcceptRev(rev: Revision) {
  // DOM-level: for each change in this revision, manipulate the DOM
  const cardBodies = document.querySelectorAll('.card-body');
  const changeIds = new Set(rev.changes.map(c => c.id));
  // Mark these changes as accepted in the store
  rev.changes.forEach(c => doc.acceptChange(c.id));
  // Visually strip diff markers from all rendered content
  cardBodies.forEach(body => {
    body.querySelectorAll('.diff-delete').forEach(el => el.remove());
    body.querySelectorAll('.diff-insert, .diff-modify').forEach(el => {
      el.removeAttribute('class');
    });
  });
  ui.showToast(`已接受修订 #${rev.id}`);
}

function onRejectRev(rev: Revision) {
  // DOM-level: remove insertions, restore deletions
  const cardBodies = document.querySelectorAll('.card-body');
  cardBodies.forEach(body => {
    body.querySelectorAll('.diff-insert').forEach(el => el.remove());
    body.querySelectorAll('.diff-delete, .diff-modify').forEach(el => {
      el.removeAttribute('class');
    });
  });
  rev.changes.forEach(c => doc.rejectChange(c.id));
  ui.showToast(`已拒绝修订 #${rev.id}`);
}
</script>

<style scoped>
.revision-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.revision-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
}

.revision-tab {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 150ms ease-in-out;
  font-family: var(--font-sans);
}

.revision-tab.active {
  color: var(--foreground);
  border-bottom-color: var(--primary);
}

.revision-tab:hover {
  color: var(--foreground);
}

.revision-timeline {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.revision-entry {
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  transition: background 150ms;
  cursor: pointer;
  position: relative;
}

.revision-entry:hover {
  background: color-mix(in srgb, var(--accent) 70%, transparent);
}

.revision-entry.active {
  background: color-mix(in srgb, var(--ring) 8%, transparent);
  border-left: 3px solid var(--primary);
}

.entry-time {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 4px;
}

.entry-label {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  margin-bottom: 4px;
}

.entry-label.ai {
  background: color-mix(in srgb, var(--diff-modify) 15%, transparent);
  color: var(--diff-modify);
}

.entry-label.human {
  background: color-mix(in srgb, var(--diff-insert) 15%, transparent);
  color: var(--diff-insert);
}

.entry-stats {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--muted-foreground);
  display: flex;
  gap: 8px;
}

.entry-stats .ins { color: var(--diff-insert); }
.entry-stats .del { color: var(--diff-delete); }
.entry-stats .mod { color: var(--diff-modify); }

.entry-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 150ms;
}

.revision-entry:hover .entry-actions {
  opacity: 1;
}

.mini-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.mini-btn.accept {
  background: color-mix(in srgb, var(--diff-insert) 15%, transparent);
  color: var(--diff-insert);
}

.mini-btn.accept:hover {
  background: var(--diff-insert);
  color: white;
}

.mini-btn.reject {
  background: color-mix(in srgb, var(--diff-delete) 15%, transparent);
  color: var(--diff-delete);
}

.mini-btn.reject:hover {
  background: var(--diff-delete);
  color: white;
}

.empty-revisions {
  padding: 16px;
  font-size: 13px;
  color: var(--muted-foreground);
  text-align: center;
}

.revision-overview {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.overview-stats {
  margin-bottom: 16px;
}

.stat-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-values {
  display: flex;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 14px;
}

.stat-values .ins { color: var(--diff-insert); font-weight: 600; }
.stat-values .del { color: var(--diff-delete); font-weight: 600; }
.stat-values .mod { color: var(--diff-modify); font-weight: 600; }

.overview-meta {
  font-size: 13px;
  color: var(--muted-foreground);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.revision-actions {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  font-family: var(--font-sans);
  text-align: left;
}

.action-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.action-btn .icon {
  font-size: 14px;
}
</style>

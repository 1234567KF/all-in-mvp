<template>
  <div class="status-bar">
    <span class="stat">字数: {{ doc.wordCount.toLocaleString() }}</span>
    <span class="stat">行数: {{ doc.lineCount }}</span>
    <span class="stat">模式: {{ ui.viewMode === 'card' ? '卡片嵌套' : '流式' }}</span>
    <span class="stat">追踪: {{ doc.hasBaseVersion ? '开启' : '关闭' }}</span>
    <span style="margin-left: auto; font-size: 11px">Ctrl+S 保存 · Ctrl+Z 撤销</span>
  </div>
</template>

<script setup lang="ts">
import { useDocumentStore } from '../../stores/documentStore';
import { useUiStore } from '../../stores/uiStore';

const doc = useDocumentStore();
const ui = useUiStore();
</script>

<style scoped>
.status-bar {
  height: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--muted);
  font-size: 12px;
  color: var(--muted-foreground);
  gap: 16px;
}

.stat {
  white-space: nowrap;
}
</style>

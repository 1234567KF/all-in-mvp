<template>
  <div class="content-panel" :class="{ 'flow-mode': viewMode === 'flow', 'diff-visible': diffVisible }">
    <div class="content-scroll" ref="scrollRef">
      <div class="card-nest" ref="contentRef">
        <MdCard
          v-for="h in doc.headings"
          :key="h.id"
          :heading="h"
          :level="1"
          :diffVisible="diffVisible"
          :editMode="editMode"
        />
        <div v-if="doc.headings.length === 0" class="empty-state">
          <p>暂无内容。请打开一个 .md 文件。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDocumentStore } from '../../stores/documentStore';
import MdCard from './MdCard.vue';

defineProps<{
  viewMode: 'card' | 'flow';
  diffVisible: boolean;
  editMode: boolean;
}>();

const doc = useDocumentStore();
const scrollRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
</script>

<style scoped>
.content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--background);
  min-width: 0;
}

.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.card-nest {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-nest .card-nest {
  gap: 8px;
}

.empty-state {
  text-align: center;
  color: var(--muted-foreground);
  padding: 48px;
  font-size: 14px;
}
</style>

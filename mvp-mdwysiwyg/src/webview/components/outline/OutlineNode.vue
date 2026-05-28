<template>
  <div>
    <div
      v-show="isVisible"
      class="outline-node"
      :class="[
        'level-' + Math.min(level, 6),
        { active: activeId === heading.id },
        { 'drag-over': isDragOver },
        { dragging: isDragging },
      ]"
      :style="{ paddingLeft: (level - 1) * 16 + 8 + 'px' }"
      draggable="true"
      @click="onClick"
      @dragstart="onDragStart"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
      @dragend="onDragEnd"
    >
      <span
        class="fold-arrow"
        :class="{ invisible: !hasChildren }"
        @click.stop="hasChildren && (isCollapsed = !isCollapsed)"
      >{{ isCollapsed ? '▸' : '▾' }}</span>
      <span class="node-icon" :class="'lv' + Math.min(level, 6)">
        H{{ Math.min(level, 6) }}
      </span>
      <span class="node-label">{{ heading.text }}</span>
    </div>
    <div v-if="hasChildren && !isCollapsed">
      <OutlineNode
        v-for="child in heading.children"
        :key="child.id"
        :heading="child"
        :level="level + 1"
        :activeId="activeId"
        :searchQuery="searchQuery"
        @navigate="(id: string) => $emit('navigate', id)"
        @reorder="(payload: { draggedId: string; targetId: string }) => $emit('reorder', payload)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Heading } from '../../types/index';

const props = defineProps<{
  heading: Heading;
  level: number;
  activeId: string | null;
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: 'navigate', headingId: string): void;
  (e: 'reorder', payload: { draggedId: string; targetId: string }): void;
}>();

const isCollapsed = ref(false);
const isDragOver = ref(false);
const isDragging = ref(false);

const hasChildren = computed(() => props.heading.children.length > 0);

const isVisible = computed(() => {
  if (!props.searchQuery) return true;
  const q = props.searchQuery.toLowerCase();
  if (props.heading.text.toLowerCase().includes(q)) return true;
  function hasMatch(node: Heading): boolean {
    if (node.text.toLowerCase().includes(q)) return true;
    return node.children.some(hasMatch);
  }
  return props.heading.children.some(hasMatch);
});

function onClick() {
  emit('navigate', props.heading.id);
}

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', props.heading.id);
  isDragging.value = true;
}

function onDragOver(e: DragEvent) {
  if (!e.dataTransfer) return;
  const draggedId = e.dataTransfer.types.includes('text/plain') ? '' : null;
  if (draggedId === null) return;
  isDragOver.value = true;
  e.dataTransfer.dropEffect = 'move';
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const draggedId = e.dataTransfer?.getData('text/plain');
  if (draggedId && draggedId !== props.heading.id) {
    emit('reorder', { draggedId, targetId: props.heading.id });
  }
}

function onDragEnd() {
  isDragging.value = false;
  isDragOver.value = false;
}
</script>

<style scoped>
.outline-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--foreground);
  transition: background 150ms ease-in-out;
  position: relative;
  user-select: none;
}

.outline-node:hover {
  background: color-mix(in srgb, var(--accent) 50%, transparent);
}

.outline-node.active {
  background: color-mix(in srgb, var(--ring) 10%, transparent);
}

.outline-node.drag-over {
  background: color-mix(in srgb, var(--ring) 15%, transparent);
  box-shadow: inset 0 -2px 0 var(--primary);
}

.outline-node.dragging {
  opacity: 0.4;
}

.outline-node.level-1 { font-weight: 600; }
.outline-node.level-2 { font-weight: 500; }
.outline-node.level-3,
.outline-node.level-4,
.outline-node.level-5,
.outline-node.level-6 { font-weight: 400; }
.outline-node.level-4,
.outline-node.level-5 { font-size: 12px; }
.outline-node.level-6 { font-size: 11px; }

.fold-arrow {
  width: 12px;
  font-size: 10px;
  cursor: pointer;
  color: var(--muted-foreground);
  flex-shrink: 0;
  text-align: center;
}

.fold-arrow.invisible {
  visibility: hidden;
  cursor: default;
}

.node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  flex-shrink: 0;
  border: 1.5px solid;
}

.node-icon.lv1 { width: 28px; height: 28px; font-size: 10px; background: #1D4ED8; border-color: #3B82F6; color: #FFF; }
.node-icon.lv2 { width: 24px; height: 24px; font-size: 9px; background: #059669; border-color: #34D399; color: #FFF; }
.node-icon.lv3 { width: 22px; height: 22px; font-size: 8px; background: #D97706; border-color: #FBBF24; color: #FFF; }
.node-icon.lv4 { width: 20px; height: 20px; font-size: 8px; background: #7C3AED; border-color: #A78BFA; color: #FFF; }
.node-icon.lv5 { width: 18px; height: 18px; font-size: 7px; border-width: 1px; background: #BE185D; border-color: #F472B6; color: #FFF; }
.node-icon.lv6 { width: 16px; height: 16px; font-size: 7px; border-width: 1px; background: #78716C; border-color: #A8A29E; color: #FFF; }

.node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

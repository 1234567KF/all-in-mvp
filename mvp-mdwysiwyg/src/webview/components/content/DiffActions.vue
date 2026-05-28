<template>
  <span
    v-if="diffVisible && !change.accepted"
    class="diff-actions"
    :data-rev="change.id"
  >
    <button class="accept-btn" @click.stop="onAccept" title="接受">✓</button>
    <button class="reject-btn" @click.stop="onRejectStart" title="拒绝">✗</button>

    <!-- Reject confirmation popover -->
    <div v-if="showRejectPopover" class="reject-popover">
      <div class="popover-content">
        <div class="old-text">旧版 (V0)：<span class="strike">{{ change.oldText }}</span></div>
        <div class="new-text">新版 (V1)：<span class="green">{{ change.newText }}</span></div>
        <div class="popover-actions">
          <button class="confirm-btn" @click.stop="onRejectConfirm">确认撤回</button>
          <button class="cancel-btn" @click.stop="showRejectPopover = false">取消</button>
        </div>
      </div>
    </div>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { DiffChange } from '../../types/index';
import { useVscodeApi } from '../../composables/useVscodeApi';
import { useDocumentStore } from '../../stores/documentStore';

const props = defineProps<{
  change: DiffChange;
  diffVisible: boolean;
}>();

const { postMessage } = useVscodeApi();
const doc = useDocumentStore();
const showRejectPopover = ref(false);

function onAccept() {
  doc.acceptChange(props.change.id);
  postMessage('revision:accept', { changeId: props.change.id });
}

function onRejectStart() {
  showRejectPopover.value = !showRejectPopover.value;
}

function onRejectConfirm() {
  doc.rejectChange(props.change.id);
  postMessage('revision:reject', { changeId: props.change.id });
  showRejectPopover.value = false;
}
</script>

<style scoped>
.diff-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 6px;
  vertical-align: middle;
  position: relative;
}

.diff-actions button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--background);
  border-radius: 50%;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 0;
  transition: all 150ms ease-in-out;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.diff-actions button:hover {
  background: var(--accent);
  transform: scale(1.05);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.1);
}

.accept-btn {
  color: var(--diff-insert);
  border-color: color-mix(in srgb, var(--diff-insert) 40%, transparent);
}

.accept-btn:hover {
  background: color-mix(in srgb, var(--diff-insert) 12%, transparent) !important;
  border-color: var(--diff-insert);
}

.reject-btn {
  color: var(--diff-delete);
  border-color: color-mix(in srgb, var(--diff-delete) 40%, transparent);
}

.reject-btn:hover {
  background: color-mix(in srgb, var(--diff-delete) 12%, transparent) !important;
  border-color: var(--diff-delete);
}

.reject-popover {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 50;
  margin-top: 4px;
}

.popover-content {
  width: 256px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  padding: 12px;
  font-size: 13px;
}

.old-text {
  color: var(--diff-delete);
  margin-bottom: 4px;
}

.old-text .strike {
  text-decoration: line-through;
}

.new-text {
  color: var(--diff-insert);
  margin-bottom: 8px;
}

.new-text .green {
  font-weight: 500;
}

.popover-actions {
  display: flex;
  gap: 8px;
}

.confirm-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--diff-delete);
  border-radius: 4px;
  background: color-mix(in srgb, var(--diff-delete) 10%, transparent);
  color: var(--diff-delete);
  cursor: pointer;
}

.confirm-btn:hover {
  background: color-mix(in srgb, var(--diff-delete) 20%, transparent);
}

.cancel-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--muted-foreground);
  cursor: pointer;
}

.cancel-btn:hover {
  background: var(--accent);
}
</style>

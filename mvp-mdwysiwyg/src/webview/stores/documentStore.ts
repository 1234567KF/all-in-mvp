import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Heading, DiffChange, DiffStats, Revision, BaseVersion } from '../types/index';

export const useDocumentStore = defineStore('document', () => {
  const content = ref('');
  const headings = ref<Heading[]>([]);
  const diffChanges = ref<DiffChange[]>([]);
  const diffStats = ref<DiffStats>({ inserted: 0, deleted: 0, modified: 0 });
  const revisions = ref<Revision[]>([]);
  const baseVersion = ref<BaseVersion | null>(null);

  const wordCount = computed(() => {
    const text = content.value.replace(/[#*`~>\-|]/g, '').trim();
    return text.split(/\s+/).filter(Boolean).length;
  });

  const lineCount = computed(() => content.value.split('\n').length);

  const hasBaseVersion = computed(() => baseVersion.value !== null);

  const pendingChanges = computed(() =>
    diffChanges.value.filter((c) => !c.accepted)
  );

  function setContent(newContent: string) {
    content.value = newContent;
  }

  function setHeadings(newHeadings: Heading[]) {
    headings.value = newHeadings;
  }

  function setDiffResult(changes: DiffChange[], stats: DiffStats) {
    diffChanges.value = changes;
    diffStats.value = stats;
  }

  function setRevisions(newRevisions: Revision[], newBase: BaseVersion | null) {
    revisions.value = newRevisions;
    baseVersion.value = newBase;
  }

  function acceptChange(changeId: string) {
    const idx = diffChanges.value.findIndex((c) => c.id === changeId);
    if (idx !== -1) {
      diffChanges.value[idx].accepted = true;
    }
  }

  function rejectChange(changeId: string) {
    const idx = diffChanges.value.findIndex((c) => c.id === changeId);
    if (idx !== -1) {
      diffChanges.value.splice(idx, 1);
    }
  }

  function acceptAllChanges() {
    diffChanges.value.forEach((c) => { c.accepted = true; });
    diffStats.value = { inserted: 0, deleted: 0, modified: 0 };
  }

  function rejectAllChanges() {
    diffChanges.value = [];
    diffStats.value = { inserted: 0, deleted: 0, modified: 0 };
  }

  function setBaseVersionLocal(bv: BaseVersion) {
    baseVersion.value = bv;
  }

  function clearBaseVersionLocal() {
    baseVersion.value = null;
    diffChanges.value = [];
    diffStats.value = { inserted: 0, deleted: 0, modified: 0 };
  }

  return {
    content, headings, diffChanges, diffStats, revisions, baseVersion,
    wordCount, lineCount, hasBaseVersion, pendingChanges,
    setContent, setHeadings, setDiffResult, setRevisions,
    acceptChange, rejectChange, acceptAllChanges, rejectAllChanges,
    setBaseVersionLocal, clearBaseVersionLocal,
  };
});

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ViewMode = 'card' | 'flow';

export const useUiStore = defineStore('ui', () => {
  const viewMode = ref<ViewMode>('card');
  const editMode = ref(false);
  const diffVisible = ref(true);
  const outlineCollapsed = ref(false);
  const revisionCollapsed = ref(false);
  const outlineWidth = ref(240);
  const revisionWidth = ref(280);
  const activeHeadingId = ref<string | null>(null);
  const searchQuery = ref('');
  const darkMode = ref(false);
  const toast = ref<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Persist dark mode
  watch(darkMode, (val) => {
    document.documentElement.classList.toggle('dark', val);
  });

  function setViewMode(mode: ViewMode) { viewMode.value = mode; }
  function toggleEditMode() { editMode.value = !editMode.value; }
  function toggleDiffVisible() { diffVisible.value = !diffVisible.value; }
  function toggleOutline() { outlineCollapsed.value = !outlineCollapsed.value; }
  function toggleRevision() { revisionCollapsed.value = !revisionCollapsed.value; }
  function setActiveHeading(id: string | null) { activeHeadingId.value = id; }
  function toggleDarkMode() { darkMode.value = !darkMode.value; }

  function showToast(msg: string) {
    toast.value = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.value = null; }, 2000);
  }

  return {
    viewMode, editMode, diffVisible,
    outlineCollapsed, revisionCollapsed,
    outlineWidth, revisionWidth,
    activeHeadingId, searchQuery,
    darkMode, toast,
    setViewMode, toggleEditMode, toggleDiffVisible,
    toggleOutline, toggleRevision, setActiveHeading,
    toggleDarkMode, showToast,
  };
});

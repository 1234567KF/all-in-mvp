<template>
  <div :id="heading.id" class="md-card" :class="cardClass" ref="cardRef">
    <div
      class="card-header"
      :contenteditable="editMode"
      @blur="onHeaderBlur"
    >
      <span class="heading-text" :style="headingStyle">{{ heading.text }}</span>
    </div>

    <div
      class="card-body"
      :contenteditable="editMode"
      v-html="bodyWithDiffButtons"
      @blur="onBodyBlur"
      @click="onDiffBtnClick"
    />

    <div v-if="heading.children.length > 0" class="card-nest">
      <MdCard
        v-for="child in heading.children"
        :key="child.id"
        :heading="child"
        :level="level + 1"
        :diffVisible="diffVisible"
        :editMode="editMode"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useDocumentStore } from '../../stores/documentStore';
import { useUiStore } from '../../stores/uiStore';
import type { Heading } from '../../types/index';

const doc = useDocumentStore();
const ui = useUiStore();

const props = defineProps<{
  heading: Heading;
  level: number;
  diffVisible: boolean;
  editMode: boolean;
}>();

const cardRef = ref<HTMLElement | null>(null);
const hClass = computed(() => 'h' + Math.min(props.level, 6));
const cardClass = computed(() => hClass.value);

const headingStyle = computed(() => {
  const sizes: Record<number, string> = {
    1: 'font-size: 48px; font-weight: 800; letter-spacing: -0.025em;',
    2: 'font-size: 36px; font-weight: 700; letter-spacing: -0.025em;',
    3: 'font-size: 24px; font-weight: 600; letter-spacing: -0.025em;',
    4: 'font-size: 20px; font-weight: 600;',
    5: 'font-size: 16px; font-weight: 500;',
    6: 'font-size: 14px; font-weight: 500;',
  };
  return sizes[Math.min(props.level, 6)] || sizes[6];
});

const renderedBody = computed(() => {
  const bodies = (window as any).__demoBodies as Record<string, string> | undefined;
  if (bodies && bodies[props.heading.text]) {
    return bodies[props.heading.text];
  }
  return '<p style="color: var(--muted-foreground); font-size: 14px"><em>正文内容区域</em></p>';
});

// Wrap diff spans with inline accept/reject buttons
const bodyWithDiffButtons = computed(() => {
  if (!props.diffVisible) return renderedBody.value;
  let html = renderedBody.value;
  // Add action buttons after each diff span
  html = html.replace(
    /(<span class="(diff-insert|diff-delete|diff-modify)")/g,
    '<span class="diff-wrap">$1'
  );
  html = html.replace(
    /(<span class="diff-wrap"><span class="diff-(?:insert|delete|modify)">[^<]*<\/span>)(<\/span>)/g,
    '$1<span class="diff-actions"><button class="diff-btn diff-accept" title="接受">&#10003;</button><button class="diff-btn diff-reject" title="拒绝">&#10007;</button></span></span>'
  );
  return html;
});

function onHeaderBlur(e: Event) {
  const el = e.target as HTMLElement;
  const newText = el.textContent?.trim();
  if (newText && newText !== props.heading.text) {
    function updateHeading(list: Heading[]): boolean {
      for (const h of list) {
        if (h.id === props.heading.id) {
          h.text = newText;
          return true;
        }
        if (h.children.length && updateHeading(h.children)) return true;
      }
      return false;
    }
    updateHeading(doc.headings);
    doc.headings = [...doc.headings];
  }
}

function onBodyBlur(_e: Event) {
  // Body edited via contenteditable — in full impl would sync to markdown AST
}

function onDiffBtnClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const btn = target.closest('.diff-btn');
  if (!btn) return;
  e.stopPropagation();
  const wrap = btn.closest('.diff-wrap');
  if (!wrap) return;
  const diffSpan = wrap.querySelector('.diff-insert, .diff-delete, .diff-modify');
  if (!diffSpan) return;

  if (btn.classList.contains('diff-accept')) {
    // Accept: keep text, remove diff styling
    const text = diffSpan.textContent || '';
    const textNode = document.createTextNode(text);
    diffSpan.parentNode?.replaceChild(textNode, diffSpan);
    // Remove the actions span
    const actions = wrap.querySelector('.diff-actions');
    if (actions) actions.remove();
    // Unwrap the diff-wrap
    while (wrap.firstChild) wrap.parentNode?.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
    ui.showToast('已接受此变更');
  } else if (btn.classList.contains('diff-reject')) {
    // Reject: remove insert entirely, restore delete, strip modify
    if (diffSpan.classList.contains('diff-insert')) {
      wrap.remove();
    } else {
      // delete or modify: keep text, strip marker
      const text = diffSpan.textContent || '';
      const textNode = document.createTextNode(text);
      diffSpan.parentNode?.replaceChild(textNode, diffSpan);
      const actions = wrap.querySelector('.diff-actions');
      if (actions) actions.remove();
      while (wrap.firstChild) wrap.parentNode?.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
    }
    ui.showToast('已拒绝此变更');
  }
}

// Listen for mdw:insert to add content under active heading
function onInsertEvent(e: Event) {
  const { level } = (e as CustomEvent).detail;
  if (ui.activeHeadingId !== props.heading.id) return;
  const newId = 'h-' + Date.now();
  const newHeading: Heading = {
    id: newId,
    level: level || (props.level + 1),
    text: level === 0 ? '新段落' : `新 H${level} 标题`,
    children: [],
  };
  function insertChild(list: Heading[]): boolean {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === props.heading.id) {
        if (level === 0) {
          list.splice(i + 1, 0, newHeading);
        } else {
          list[i].children.push(newHeading);
        }
        return true;
      }
      if (insertChild(list[i].children)) return true;
    }
    return false;
  }
  insertChild(doc.headings);
  doc.headings = [...doc.headings];
  setTimeout(() => {
    const el = document.getElementById(newId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

onMounted(() => {
  window.addEventListener('mdw:insert', onInsertEvent);
});
onUnmounted(() => {
  window.removeEventListener('mdw:insert', onInsertEvent);
});
</script>

<style scoped>
.md-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--card-foreground);
  transition: box-shadow 200ms ease, background 200ms ease;
  position: relative;
}

.md-card:hover {
  box-shadow: 0 2px 8px 0 rgb(0 0 0 / 0.08);
}

.card-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  cursor: text;
}

.heading-text {
  font-weight: 700;
  line-height: 1.1;
}

.card-body {
  font-size: 16px;
  line-height: 1.6;
}

.card-body :deep(p) { margin-bottom: 8px; }
.card-body :deep(p:last-child) { margin-bottom: 0; }
.card-body :deep(strong) { font-weight: 600; }
.card-body :deep(code) {
  background: var(--muted);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 14px;
  font-family: var(--font-mono);
}
.card-body :deep(pre) {
  background: var(--muted);
  border-radius: var(--radius);
  padding: 12px;
  overflow-x: auto;
  margin-bottom: 12px;
  position: relative;
}
.card-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
}
.card-body :deep(blockquote) {
  border-left: 2px solid var(--border);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--muted-foreground);
  font-style: italic;
  background: color-mix(in srgb, var(--muted) 30%, transparent);
  border-radius: 0 4px 4px 0;
  padding: 8px 12px;
}
.card-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 14px;
}
.card-body :deep(table th) {
  background: var(--muted);
  font-weight: 600;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.card-body :deep(table td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.card-body :deep(table tr:hover td) {
  background: color-mix(in srgb, var(--accent) 50%, transparent);
}
.card-body :deep(ul),
.card-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 8px;
}
.card-body :deep(li) { margin-bottom: 4px; }
.card-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}

/* H1 — large prominent card */
.md-card.h1 {
  padding: 24px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.06), 0 0 0 1px var(--border);
  margin-left: 0;
}

/* H2 — accent-bordered card */
.md-card.h2 {
  padding: 20px;
  background: var(--background);
  margin-left: 20px;
  border-left: 4px solid var(--primary);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.04);
}

/* H3 */
.md-card.h3 {
  padding: 14px;
  margin-left: 40px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--muted) 50%, transparent);
  border-radius: calc(var(--radius) - 2px);
  border-left: 3px solid var(--muted-foreground);
}

.md-card.h3 .card-header {
  border-bottom-color: color-mix(in srgb, var(--border) 50%, transparent);
}

/* H4 */
.md-card.h4 {
  padding: 10px;
  margin-left: 56px;
  border: none;
  background: transparent;
  border-left: 2px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
}

.md-card.h4 .card-header {
  border-bottom: none;
  padding-bottom: 4px;
  margin-bottom: 8px;
}

/* H5 */
.md-card.h5 {
  padding: 8px;
  margin-left: 64px;
  border: none;
  background: transparent;
}

/* H6 */
.md-card.h6 {
  padding: 6px;
  margin-left: 68px;
  border: none;
  background: transparent;
}

/* Flow mode — word-like continuous layout */
:global(.flow-mode) .md-card {
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin-left: 0 !important;
}

:global(.flow-mode) .md-card:hover {
  box-shadow: none !important;
}

:global(.flow-mode) .card-header {
  border-bottom: none !important;
  margin-bottom: 4px !important;
  padding-bottom: 0 !important;
}

:global(.flow-mode) .card-nest {
  gap: 0 !important;
}

:global(.flow-mode) .md-card.h1 { margin: 24px 0 12px 0 !important; }
:global(.flow-mode) .md-card.h2 { margin: 18px 0 8px 0 !important; }
:global(.flow-mode) .md-card.h3 { margin: 12px 0 6px 0 !important; }
:global(.flow-mode) .md-card.h4 { margin: 8px 0 4px 0 !important; }
:global(.flow-mode) .md-card.h5,
:global(.flow-mode) .md-card.h6 { margin: 6px 0 !important; }

:global(.flow-mode) .md-card.h1 .heading-text { font-size: 2em !important; }
:global(.flow-mode) .md-card.h2 .heading-text { font-size: 1.5em !important; }
:global(.flow-mode) .md-card.h3 .heading-text { font-size: 1.25em !important; }
:global(.flow-mode) .md-card.h4 .heading-text { font-size: 1.1em !important; }
:global(.flow-mode) .md-card.h5 .heading-text { font-size: 1em !important; }
:global(.flow-mode) .md-card.h6 .heading-text { font-size: 0.9em !important; }

/* Diff markers */
.card-body :deep(.diff-wrap) {
  position: relative;
  display: inline;
}

.card-body :deep(.diff-wrap:hover .diff-actions) {
  display: inline-flex;
}

.card-body :deep(.diff-insert) {
  color: var(--diff-insert);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.card-body :deep(.diff-delete) {
  color: var(--diff-delete);
  text-decoration: line-through;
}

.card-body :deep(.diff-modify) {
  background: color-mix(in srgb, var(--diff-modify) 15%, transparent);
}

/* Inline diff action buttons */
.card-body :deep(.diff-actions) {
  display: none;
  position: absolute;
  top: -24px;
  right: 0;
  gap: 2px;
  z-index: 20;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
}

.card-body :deep(.diff-btn) {
  width: 20px;
  height: 18px;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.card-body :deep(.diff-accept) {
  color: var(--diff-insert);
  background: transparent;
}
.card-body :deep(.diff-accept:hover) {
  background: var(--diff-insert);
  color: white;
}

.card-body :deep(.diff-reject) {
  color: var(--diff-delete);
  background: transparent;
}
.card-body :deep(.diff-reject:hover) {
  background: var(--diff-delete);
  color: white;
}

/* Mermaid */
.card-body :deep(.mermaid-container) {
  background: var(--muted);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  overflow-x: auto;
  text-align: center;
}
</style>

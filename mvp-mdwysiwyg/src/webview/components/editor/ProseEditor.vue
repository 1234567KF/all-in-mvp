<template>
  <div ref="editorContainer" class="prose-editor" :class="{ readonly: !editMode }" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, DOMSerializer } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap, toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';

const props = defineProps<{
  content: string;
  editMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'change', content: string): void;
  (e: 'save', content: string): void;
  (e: 'headingChange', id: string, text: string): void;
}>();

const editorContainer = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

// ProseMirror schema matching our Markdown structure
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    heading: {
      attrs: { level: { default: 1 }, id: { default: '' } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM(node) {
        return [`h${node.attrs.level}`, { id: node.attrs.id, class: 'pm-heading' }, 0];
      },
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0]; },
    },
    codeBlock: {
      attrs: { language: { default: '' } },
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM(node) {
        return ['pre', { 'data-language': node.attrs.language }, ['code', 0]];
      },
    },
    blockquote: {
      content: 'block+',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0]; },
    },
    bulletList: {
      content: 'listItem+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() { return ['ul', 0]; },
    },
    orderedList: {
      attrs: { start: { default: 1 } },
      content: 'listItem+',
      group: 'block',
      parseDOM: [{ tag: 'ol' }],
      toDOM(node) {
        return node.attrs.start === 1 ? ['ol', 0] : ['ol', { start: node.attrs.start }, 0];
      },
    },
    listItem: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() { return ['li', 0]; },
    },
    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr']; },
    },
    text: { group: 'inline' },
    hardBreak: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() { return ['br']; },
    },
  },
  marks: {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM() { return ['strong', 0]; },
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM() { return ['em', 0]; },
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() { return ['code', 0]; },
    },
    strikethrough: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }],
      toDOM() { return ['s', 0]; },
    },
  },
});

function createState(content: string, editable: boolean): EditorState {
  // Parse HTML content into ProseMirror document
  const div = document.createElement('div');
  div.innerHTML = content || '<p></p>';
  const doc = DOMParser.fromSchema(schema).parse(div);

  return EditorState.create({
    doc,
    plugins: [
      history(),
      keymap({
        'Mod-s': () => {
          emit('save', serializeToMarkdown());
          return true;
        },
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        'Mod-b': toggleMark(schema.marks.bold),
        'Mod-i': toggleMark(schema.marks.italic),
      }),
      keymap(baseKeymap),
    ],
    editable: () => editable,
  });
}

function serializeToMarkdown(): string {
  if (!view) return '';
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeFragment(view.state.doc.content);
  const div = document.createElement('div');
  div.appendChild(fragment);
  // Basic HTML-to-Markdown conversion
  return htmlToMarkdown(div);
}

function htmlToMarkdown(el: HTMLElement): string {
  const lines: string[] = [];

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const elem = node as HTMLElement;
    const tag = elem.tagName.toLowerCase();
    const children = Array.from(elem.childNodes).map(processNode).join('');

    switch (tag) {
      case 'h1': return `\n# ${children}\n`;
      case 'h2': return `\n## ${children}\n`;
      case 'h3': return `\n### ${children}\n`;
      case 'h4': return `\n#### ${children}\n`;
      case 'h5': return `\n##### ${children}\n`;
      case 'h6': return `\n###### ${children}\n`;
      case 'p': return `\n${children}\n`;
      case 'strong':
      case 'b': return `**${children}**`;
      case 'em':
      case 'i': return `*${children}*`;
      case 'code': return `\`${children}\``;
      case 'pre': return `\n\`\`\`\n${children}\n\`\`\`\n`;
      case 'blockquote': return `\n> ${children}\n`;
      case 'ul': return `\n${children}\n`;
      case 'ol': return `\n${children}\n`;
      case 'li': return `- ${children}\n`;
      case 'hr': return '\n---\n';
      case 'br': return '\n';
      case 's':
      case 'del': return `~~${children}~~`;
      default: return children;
    }
  }

  const result = processNode(el);
  return result.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

onMounted(() => {
  if (!editorContainer.value) return;
  const state = createState(props.content, props.editMode);
  view = new EditorView(editorContainer.value, {
    state,
    dispatchTransaction(tr) {
      if (!view) return;
      const newState = view.state.apply(tr);
      view.updateState(newState);
      if (tr.docChanged) {
        emit('change', serializeToMarkdown());
      }
    },
  });
});

watch(() => props.editMode, (newVal) => {
  if (view) {
    view.setProps({ editable: () => newVal });
  }
});

onUnmounted(() => {
  view?.destroy();
  view = null;
});
</script>

<style scoped>
.prose-editor {
  min-height: 100px;
}

.prose-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 50px;
}

.prose-editor :deep(.ProseMirror p) {
  margin-bottom: 8px;
}

.prose-editor :deep(.ProseMirror h1) {
  font-size: 2em;
  font-weight: 800;
  margin: 16px 0 8px;
}

.prose-editor :deep(.ProseMirror h2) {
  font-size: 1.5em;
  font-weight: 700;
  margin: 12px 0 6px;
}

.prose-editor :deep(.ProseMirror h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 8px 0 4px;
}

.prose-editor :deep(.ProseMirror pre) {
  background: var(--muted);
  border-radius: var(--radius);
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.prose-editor :deep(.ProseMirror blockquote) {
  border-left: 2px solid var(--border);
  padding-left: 12px;
  color: var(--muted-foreground);
  font-style: italic;
}

.prose-editor :deep(.ProseMirror ul) { padding-left: 24px; list-style: disc; }
.prose-editor :deep(.ProseMirror ol) { padding-left: 24px; list-style: decimal; }

.prose-editor.readonly :deep(.ProseMirror) {
  cursor: default;
}

.prose-editor :deep(.ProseMirror:focus) {
  outline: none;
}

.prose-editor :deep(.ProseMirror p:focus) {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 4px;
}
</style>

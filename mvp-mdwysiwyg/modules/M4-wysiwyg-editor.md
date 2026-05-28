# M4: wysiwyg-editor

> **类型**: 前端 (WebView)  
> **依赖**: M3 (content-renderer)  
> **优先级**: P0

## 边界

ProseMirror WYSIWYG 编辑器、Markdown AST ↔ DOM 双向同步、快捷键绑定、内容插入功能。

## 文件范围

- `src/webview/components/editor/ProseEditor.vue` — ProseMirror 编辑器
- `src/webview/components/editor/HeadingEditor.vue` — 标题编辑
- `src/webview/components/content/InsertDropdown.vue` — 新增下拉菜单
- `src/webview/composables/useShortcuts.ts` — 快捷键
- `src/extension/services/markdownParser.ts` (serialize 方法复用 M1)

## 接口

### ProseEditor

```typescript
interface ProseEditorProps {
  content: string;        // Markdown 内容
  editMode: boolean;      // 是否可编辑
  diffChanges: DiffChange[]; // Diff 标记（叠加到文档）
}

interface ProseEditorEmits {
  (e: 'change', content: string): void;  // 内容变更
  (e: 'save', content: string): void;    // Ctrl+S 保存
  (e: 'headingChange', id: string, text: string): void; // 标题变更
}
```

### InsertDropdown

```typescript
interface InsertDropdownProps {
  visible: boolean;
}

interface InsertDropdownEmits {
  (e: 'insert', level: number): void;  // 0=正文, 1-6=标题级别
}
```

## ProseMirror Schema

节点: doc, heading, paragraph, codeBlock, blockquote, bulletList, orderedList, listItem, table, tableRow, tableCell, tableHeader, mermaidBlock, image, horizontalRule, text

标记: bold, italic, code, strikethrough, diffInsert, diffDelete, diffModify

## 快捷键映射

| 快捷键 | 命令 |
|--------|------|
| Ctrl+S | save |
| Ctrl+Z | undo |
| Ctrl+Y / Ctrl+Shift+Z | redo |
| Ctrl+B | toggleBold |
| Ctrl+I | toggleItalic |
| Ctrl+F | findInDocument |
| Ctrl+H | findAndReplace |
| Ctrl+Shift+E | toggleRevisionTracking |
| Ctrl+Shift+V | toggleViewMode |
| Ctrl+[ / Ctrl+] | headingLevelDown/Up |
| Alt+↑ / Alt+↓ | moveParagraphUp/Down |
| Ctrl+Shift+N | showInsertMenu |
| Esc | exitEditMode |
| Tab / Shift+Tab | indent/outdent |

## 验收标准

- AC6.1~AC6.9: WYSIWYG 编辑
- AC11.1~AC11.6: 内容插入
- AC13.1~AC13.10: 快捷键

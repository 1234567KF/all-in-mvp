# spec.md — Markdown WYSIWYG 阅读器架构设计

> **版本**: v1.0  
> **状态**: 【锁定版】

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  VS Code / Qoder / Trae                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Extension Host (Node.js)             │   │
│  │                                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │   │
│  │  │ Markdown │ │   Diff   │ │ Revision Manager  │ │   │
│  │  │  Parser  │ │  Engine  │ │ (File I/O + JSON) │ │   │
│  │  └──────────┘ └──────────┘ └───────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────┐ ┌──────────────────────────────┐   │   │
│  │  │  File    │ │  Extension Activation /      │   │   │
│  │  │ Watcher  │ │  Command Registration        │   │   │
│  │  └──────────┘ └──────────────────────────────┘   │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │ postMessage / onDidReceiveMessage  │
│  ┌──────────────────┴───────────────────────────────┐   │
│  │              WebView Panel                        │   │
│  │                                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │   │
│  │  │ Outline  │ │ Content  │ │ Revision Panel    │ │   │
│  │  │  Panel   │ │  Panel   │ │                   │ │   │
│  │  │ (Vue 3)  │ │(Vue 3 +  │ │ (Vue 3)          │ │   │
│  │  │          │ │ProseMirr)│ │                   │ │   │
│  │  └──────────┘ └──────────┘ └───────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │   │
│  │  │ Toolbar  │ │ Mermaid  │ │ Diff Renderer     │ │   │
│  │  │          │ │ Renderer │ │ (Inline overlay)  │ │   │
│  │  └──────────┘ └──────────┘ └───────────────────┘ │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

| 层 | 技术 | 版本 | 说明 |
|----|------|------|------|
| 插件框架 | VS Code Extension API | ^1.85 | 兼容 Qoder/Trae/VS Code |
| 构建工具（Extension） | esbuild | ^0.20 | 快速打包 Extension Host |
| 构建工具（WebView） | Vite | ^5 | WebView 前端构建 |
| UI 框架 | Vue 3 | ^3.4 | 组合式 API |
| 样式 | Tailwind CSS | ^3.4 | + shadcn/ui 设计令牌 |
| WYSIWYG 编辑器 | ProseMirror | ^1.x | Markdown Schema + 双向同步 |
| Markdown 解析 | markdown-it | ^14 | 可扩展插件体系 |
| Mermaid 渲染 | mermaid.js | ^10 | WebView 内 SVG 渲染 |
| Diff 算法 | diff (npm) | ^5 | 逐行+逐词对比 |
| 测试 | Vitest | ^1 | 单元测试 + 集成测试 |
| 语言 | TypeScript | ^5.3 | 全栈 TS |
| 包管理 | pnpm | ^9 | monorepo 支持 |

---

## 3. 项目结构

```
mvp-mdwysiwyg/
├── package.json              # Extension manifest + npm scripts
├── tsconfig.json
├── vite.config.ts            # WebView 构建配置
├── esbuild.mjs              # Extension Host 构建配置
├── tailwind.config.ts
├── postcss.config.js
│
├── src/
│   ├── extension/            # Extension Host 端
│   │   ├── index.ts          # 插件入口 activate/deactivate
│   │   ├── commands.ts       # 命令注册
│   │   ├── providers/
│   │   │   └── webviewProvider.ts  # CustomTextEditorProvider
│   │   ├── services/
│   │   │   ├── markdownParser.ts   # markdown-it 解析
│   │   │   ├── diffEngine.ts       # Diff 算法
│   │   │   ├── revisionManager.ts  # 修订记录管理
│   │   │   └── fileWatcher.ts      # 文件监听
│   │   └── types/
│   │       └── index.ts
│   │
│   └── webview/              # WebView 端
│       ├── index.html
│       ├── main.ts           # Vue 入口
│       ├── App.vue           # 根组件（三面板布局）
│       ├── styles/
│       │   ├── globals.css   # CSS 变量 + reset
│       │   └── tailwind.css  # Tailwind 入口
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppLayout.vue       # 三面板布局容器
│       │   │   ├── PanelDivider.vue    # 可拖拽分隔线
│       │   │   ├── Toolbar.vue         # 工具栏
│       │   │   └── StatusBar.vue       # 状态栏
│       │   ├── outline/
│       │   │   ├── OutlinePanel.vue    # 大纲面板
│       │   │   ├── OutlineNode.vue     # 大纲节点（递归）
│       │   │   └── OutlineSearch.vue   # 搜索过滤
│       │   ├── content/
│       │   │   ├── ContentPanel.vue    # 内容面板容器
│       │   │   ├── CardNest.vue        # 卡片嵌套视图
│       │   │   ├── MdCard.vue          # 单个卡片
│       │   │   ├── FlowView.vue        # 流式视图
│       │   │   ├── DiffOverlay.vue     # Diff 标记叠加
│       │   │   ├── DiffActions.vue     # 接受/拒绝按钮
│       │   │   └── InsertDropdown.vue  # 新增下拉菜单
│       │   ├── revision/
│       │   │   ├── RevisionPanel.vue   # 修订面板
│       │   │   ├── TimelineTab.vue     # 时间线 Tab
│       │   │   ├── OverviewTab.vue     # 概览 Tab
│       │   │   └── RevisionEntry.vue   # 单条修订
│       │   ├── editor/
│       │   │   ├── ProseEditor.vue     # ProseMirror 编辑器
│       │   │   └── HeadingEditor.vue   # 标题编辑
│       │   └── renderers/
│       │       ├── MermaidBlock.vue    # Mermaid 渲染
│       │       ├── CodeBlock.vue       # 代码块
│       │       ├── DataTable.vue       # 表格
│       │       └── ImageLightbox.vue   # 图片灯箱
│       ├── composables/
│       │   ├── useVscodeApi.ts     # VS Code 消息通信
│       │   ├── useDocument.ts      # 文档状态
│       │   ├── useOutline.ts       # 大纲状态
│       │   ├── useDiff.ts          # Diff 状态
│       │   ├── useRevision.ts      # 修订状态
│       │   ├── usePanelResize.ts   # 面板拖拽
│       │   └── useShortcuts.ts     # 快捷键
│       ├── stores/
│       │   ├── documentStore.ts    # 文档状态 (Pinia)
│       │   └── uiStore.ts          # UI 状态
│       └── types/
│           └── index.ts
│
├── test/
│   ├── unit/
│   │   ├── markdownParser.test.ts
│   │   ├── diffEngine.test.ts
│   │   └── revisionManager.test.ts
│   └── integration/
│       └── webview.test.ts
│
└── resources/
    └── icons/                # 扩展图标
```

---

## 4. 核心模块设计

### 4.1 Extension Host ↔ WebView 通信协议

Extension Host 与 WebView 之间通过 `postMessage` 双向通信。

**消息格式**:
```typescript
interface VsMessage<T = unknown> {
  type: string;
  payload: T;
  requestId?: string;
}
```

**消息类型（Extension → WebView）**:

| type | payload | 说明 |
|------|---------|------|
| `document:loaded` | `{ content: string; ast: Token[]; headings: Heading[] }` | 文档加载完成 |
| `document:changed` | `{ content: string; ast: Token[] }` | 外部修改触发 |
| `diff:result` | `{ changes: DiffChange[]; stats: DiffStats }` | Diff 计算完成 |
| `revision:loaded` | `{ revisions: Revision[]; baseVersion: BaseVersion \| null }` | 修订记录加载 |
| `revision:updated` | `{ revisions: Revision[] }` | 修订记录更新 |
| `outline:updated` | `{ headings: Heading[] }` | 大纲更新 |
| `command:save` | `{}` | 触发保存 |
| `command:toggleView` | `{ mode: 'card' \| 'flow' }` | 切换视图 |

**消息类型（WebView → Extension）**:

| type | payload | 说明 |
|------|---------|------|
| `document:requestLoad` | `{}` | 请求加载文档 |
| `document:save` | `{ content: string }` | 保存文档内容 |
| `document:requestDiff` | `{ v0: string; v1: string }` | 请求 Diff 计算 |
| `revision:accept` | `{ changeId: string }` | 接受单条修订 |
| `revision:reject` | `{ changeId: string }` | 拒绝单条修订 |
| `revision:acceptAll` | `{}` | 全部接受 |
| `revision:rejectAll` | `{}` | 全部拒绝 |
| `revision:setBase` | `{ content: string }` | 设为基准版本 |
| `revision:clearBase` | `{}` | 清除基准 |
| `outline:navigate` | `{ headingId: string }` | 大纲跳转 |
| `outline:reorder` | `{ fromId: string; toId: string }` | 大纲拖拽重排 |
| `ui:ready` | `{}` | WebView 就绪 |

### 4.2 Markdown 解析管线

```
.md 源文件
    ↓ markdown-it.parse()
Token[] (AST)
    ↓ transformTokens()
DocumentTree (结构化树)
    ↓ renderToProseMirrorDoc()
ProseMirror Document
    ↓ ProseMirror EditorView
WebView DOM (渲染视图)
    ↓ ProseMirror Transaction
Updated AST
    ↓ serializeToMarkdown()
.md 源文件
```

**markdown-it 插件扩展**:
- `markdown-it-mermaid`: 识别 ` ```mermaid ` 围栏，标记为特殊 token
- `markdown-it-heading-anchor`: 为标题添加锚点 ID

### 4.3 Diff 引擎管线

```
V0 .md 文件 → markdown-it.parse() → V0 Token[]
                                          ↓
                                    alignByHeadings()
                                          ↓
V1 .md 文件 → markdown-it.parse() → V1 Token[]
                                          ↓
                                    diffSections()
                                          ↓
                                    DiffChange[]
                                          ↓
                                    overlayOnWebView()
```

**对齐策略**:
1. 以 Heading token 为锚点拆分章节块
2. 块内用 `diffLines()` 逐行对比
3. 行内用 `diffWords()` 逐词对比
4. 表格按行列对齐
5. 代码块整体比较

### 4.4 ProseMirror Schema

```typescript
// 核心节点类型
const nodes = {
  doc: { content: 'block+' },
  heading: {
    attrs: { level: { default: 1 }, id: { default: '' } },
    content: 'inline*',
    group: 'block',
    toDOM: (node) => [`h${node.attrs.level}`, { id: node.attrs.id }, 0]
  },
  paragraph: { content: 'inline*', group: 'block' },
  codeBlock: {
    attrs: { language: { default: '' } },
    content: 'text*',
    group: 'block',
    code: true
  },
  blockquote: { content: 'block+', group: 'block' },
  bulletList: { content: 'listItem+', group: 'block' },
  orderedList: { attrs: { start: { default: 1 } }, content: 'listItem+', group: 'block' },
  listItem: { content: 'paragraph block*' },
  table: { content: 'tableRow+' },
  tableRow: { content: '(tableCell | tableHeader)+' },
  tableCell: { content: 'inline*' },
  tableHeader: { content: 'inline*' },
  mermaidBlock: {
    attrs: { source: { default: '' } },
    group: 'block',
    atom: true
  },
  image: {
    attrs: { src: '', alt: '', title: '' },
    group: 'block',
    atom: true
  },
  horizontalRule: { group: 'block' },
  text: { group: 'inline' }
};

// 核心标记类型
const marks = {
  bold: { toDOM: () => ['strong', 0] },
  italic: { toDOM: () => ['em', 0] },
  code: { toDOM: () => ['code', 0] },
  strikethrough: { toDOM: () => ['s', 0] },
  diffInsert: { toDOM: () => ['span', { class: 'diff-insert' }, 0] },
  diffDelete: { toDOM: () => ['span', { class: 'diff-delete' }, 0] },
  diffModify: { toDOM: () => ['span', { class: 'diff-modify' }, 0] }
};
```

### 4.5 修订持久化格式

文件路径: `.{md文件名}.revisions.json`

```typescript
interface RevisionStore {
  version: 1;
  filePath: string;
  baseVersion: {
    content: string;
    markedAt: string;  // ISO timestamp
  } | null;
  revisions: Revision[];
}

interface Revision {
  id: string;
  timestamp: string;
  triggerer: 'ai' | 'human';
  changes: DiffChange[];
  stats: {
    inserted: number;
    deleted: number;
    modified: number;
  };
  status: 'pending' | 'accepted' | 'rejected';
}
```

---

## 5. 构建配置

### 5.1 package.json (Extension Manifest)

```json
{
  "name": "md-wysiwyg-reader",
  "displayName": "Markdown WYSIWYG Reader",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onLanguage:markdown"],
  "main": "./dist/extension/index.js",
  "contributes": {
    "customEditors": [{
      "viewType": "mdWysiwyg.reader",
      "displayName": "MD WYSIWYG Reader",
      "selector": [{ "filenamePattern": "*.md" }],
      "priority": "option"
    }],
    "commands": [
      { "command": "mdWysiwyg.open", "title": "Open in WYSIWYG Reader" },
      { "command": "mdWysiwyg.setBaseVersion", "title": "Set as Base Version" },
      { "command": "mdWysiwyg.clearBaseVersion", "title": "Clear Base Version" },
      { "command": "mdWysiwyg.toggleView", "title": "Toggle View Mode" }
    ]
  }
}
```

### 5.2 构建流程

```
pnpm build
    ├── esbuild → dist/extension/index.js  (Extension Host)
    └── vite build → dist/webview/         (WebView assets)

pnpm dev
    ├── esbuild --watch → dist/extension/index.js
    └── vite build --watch → dist/webview/

pnpm test
    └── vitest run
```

---

## 6. 性能策略

| 策略 | 实现 |
|------|------|
| 懒加载 Mermaid | 仅可视区域内的 Mermaid 代码块触发渲染 |
| Diff 防抖 | 文档修改后 500ms 防抖触发 diff 计算 |
| 增量 DOM 更新 | ProseMirror 自身实现最小化 DOM 更新 |
| 大纲虚拟滚动 | 超过 200 节点时使用虚拟列表 |
| 面板懒渲染 | 折叠面板不渲染内部内容 |

---

## 7. 安全策略

| 风险 | 缓解 |
|------|------|
| WebView XSS | CSP 限制 script-src，仅加载可信 CDN |
| 文件路径遍历 | 仅操作当前打开的文件，不读取任意路径 |
| postMessage 注入 | 验证消息类型和 payload 结构 |

---

## 8. WebView CSP

```
default-src 'none';
style-src 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
script-src 'nonce-${nonce}' https://unpkg.com;
img-src vscode-resource: https: data:;
connect-src vscode-resource:;
```

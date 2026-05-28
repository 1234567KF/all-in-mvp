# M2: layout-shell

> **类型**: 前端 (WebView)  
> **依赖**: 无  
> **优先级**: P0

## 边界

三面板布局骨架、工具栏、状态栏、大纲面板（含搜索、Hn 徽章、折叠箭头）、面板折叠/拖拽分隔线。

## 文件范围

- `src/webview/App.vue` — 根组件
- `src/webview/components/layout/AppLayout.vue` — 三面板布局容器
- `src/webview/components/layout/Toolbar.vue` — 工具栏
- `src/webview/components/layout/StatusBar.vue` — 状态栏
- `src/webview/components/layout/PanelDivider.vue` — 可拖拽分隔线
- `src/webview/components/outline/OutlinePanel.vue` — 大纲面板
- `src/webview/components/outline/OutlineNode.vue` — 大纲节点（递归）
- `src/webview/components/outline/OutlineSearch.vue` — 搜索过滤
- `src/webview/composables/usePanelResize.ts` — 面板拖拽
- `src/webview/composables/useVscodeApi.ts` — VS Code 通信
- `src/webview/composables/useOutline.ts` — 大纲状态
- `src/webview/stores/documentStore.ts` — 文档状态
- `src/webview/stores/uiStore.ts` — UI 状态
- `src/webview/styles/globals.css` — CSS 变量
- `src/webview/styles/tailwind.css` — Tailwind 入口

## 接口

### 组件 Props

```typescript
// OutlineNode
interface OutlineNodeProps {
  heading: Heading;
  level: number;
  activeId: string | null;
  searchQuery: string;
}

// PanelDivider
interface PanelDividerProps {
  side: 'left' | 'right';
}

// Toolbar
interface ToolbarProps {
  viewMode: 'card' | 'flow';
  diffVisible: boolean;
  editMode: boolean;
}
```

### 事件

```typescript
// OutlineNode
emit('navigate', headingId: string);
emit('reorder', { fromId: string; toId: string });

// Toolbar
emit('toggleView', mode: 'card' | 'flow');
emit('toggleDiff');
emit('toggleEdit');
emit('insert', level: number);
emit('acceptAll');
emit('rejectAll');
emit('export');
```

## 设计规格

- 左侧面板: 240px 默认, 可折叠至 32px, 可拖拽 32~400px
- 右侧面板: 280px 默认, 可折叠至 32px, 可拖拽 32~400px
- 工具栏: h-12 (48px), Ghost 按钮, 分组竖线分隔
- 状态栏: h-8 (32px), --muted 背景
- 大纲 Hn 徽章: 彩色圆形 (H1深蓝→H6棕灰)
- 折叠动画: width 200ms ease-in-out

## 验收标准

- AC1.1~AC1.7: 三面板布局
- AC2.1~AC2.8: 大纲导航
- AC12.1~AC12.5: 工具栏
- AC15.1~AC15.3: 状态栏

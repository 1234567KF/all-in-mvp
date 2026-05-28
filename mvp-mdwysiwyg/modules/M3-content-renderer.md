# M3: content-renderer

> **类型**: 前端 (WebView)  
> **依赖**: M2 (layout-shell)  
> **优先级**: P0

## 边界

中间内容面板的所有渲染逻辑：卡片嵌套视图、流式视图、所有 Markdown 元素渲染、Mermaid 图表渲染。

## 文件范围

- `src/webview/components/content/ContentPanel.vue` — 内容面板容器
- `src/webview/components/content/CardNest.vue` — 卡片嵌套布局（递归）
- `src/webview/components/content/MdCard.vue` — 单个卡片组件
- `src/webview/components/content/FlowView.vue` — 流式视图
- `src/webview/components/renderers/MermaidBlock.vue` — Mermaid 渲染
- `src/webview/components/renderers/CodeBlock.vue` — 代码块 + 复制按钮
- `src/webview/components/renderers/DataTable.vue` — 表格
- `src/webview/components/renderers/ImageLightbox.vue` — 图片灯箱
- `src/webview/composables/useDocument.ts` — 文档渲染状态

## 接口

### 组件 Props

```typescript
// ContentPanel
interface ContentPanelProps {
  headings: Heading[];
  content: string;
  viewMode: 'card' | 'flow';
}

// MdCard
interface MdCardProps {
  heading: Heading;
  level: number;
  children: Heading[];
  body: string;  // HTML rendered body
}

// MermaidBlock
interface MermaidBlockProps {
  source: string;
}
```

## 设计规格

### 卡片嵌套 (H1→H6)

| 层级 | margin-left | padding | 边框 | 背景 | 标题字号/权重 |
|------|------------|---------|------|------|-------------|
| H1 | 0 | p-6 | border + shadow-sm | --card | 48px/800 |
| H2 | 16px | p-4 | border + left 3px primary | --background | 36px/700 |
| H3 | 32px | p-3 | border-b + left 2px muted-fg | --muted/50 | 24px/600 |
| H4 | 48px | p-2 | left 1px border | transparent | 20px/600 |
| H5 | 56px | p-1.5 | none | transparent | 16px/500 |
| H6 | 56px | p-1 | none | transparent | 14px/500 |

### 流式视图

去除所有卡片框/背景/阴影，标题字号递减 (2em→0.9em)，连续排版。

### 元素渲染

行内代码(bg-muted + mono), 代码块(语法高亮+复制按钮+语言标签), 表格(表头bg-muted+行hover), 引用块(left-border+italic), 列表(缩进), 图片(灯箱), 分隔线, Mermaid(SVG)。

## 验收标准

- AC3.1~AC3.8: 卡片嵌套视图
- AC4.1~AC4.6: 流式视图
- AC5.1~AC5.9: 元素渲染
- AC14.1~AC14.6: Mermaid 图表

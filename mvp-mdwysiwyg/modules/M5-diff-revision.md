# M5: diff-revision

> **类型**: 前端 (WebView)  
> **依赖**: M3 (content-renderer)  
> **优先级**: P1

## 边界

Diff 标记的 UI 渲染（内联三色标记 + 卡片级标记）、接受/拒绝操作按钮、修订时间线面板、概览 Tab、基准版本管理 UI。

## 文件范围

- `src/webview/components/content/DiffOverlay.vue` — Diff 标记叠加
- `src/webview/components/content/DiffActions.vue` — 接受/拒绝按钮
- `src/webview/components/revision/RevisionPanel.vue` — 修订面板容器
- `src/webview/components/revision/TimelineTab.vue` — 时间线 Tab
- `src/webview/components/revision/OverviewTab.vue` — 概览 Tab
- `src/webview/components/revision/RevisionEntry.vue` — 单条修订
- `src/webview/composables/useDiff.ts` — Diff 状态
- `src/webview/composables/useRevision.ts` — 修订状态

## 接口

### DiffActions

```typescript
interface DiffActionsProps {
  changeId: string;
  changeType: 'insert' | 'delete' | 'modify';
  oldText: string;
  newText: string;
}

interface DiffActionsEmits {
  (e: 'accept', changeId: string): void;
  (e: 'reject', changeId: string): void;
}
```

### RevisionPanel

```typescript
interface RevisionPanelProps {
  revisions: Revision[];
  baseVersion: BaseVersion | null;
  stats: DiffStats;
}

interface RevisionPanelEmits {
  (e: 'navigate', changeId: string): void;
  (e: 'acceptAll'): void;
  (e: 'rejectAll'): void;
  (e: 'rollback'): void;
  (e: 'exportWithRevisions'): void;
  (e: 'setBase'): void;
  (e: 'clearBase'): void;
}
```

## 设计规格

### 内联 Diff 三态

| 类型 | 文字样式 | 背景 | 左侧指示器 |
|------|----------|------|-----------|
| insert | #16A34A + underline | 无 | 3px #16A34A 竖线 |
| delete | #DC2626 + line-through | 无 | 3px #DC2626 竖线 |
| modify | inherit | #F97316 15% alpha | 3px #F97316 竖线 |

### 操作按钮

- ✓ 接受: h-6 w-16, green border/text, rounded
- ✗ 拒绝: h-6 w-16, red border/text, rounded
- 拒绝流程: 点击 → 展开对比卡片(V0/V1) → 确认撤回/取消

### 修订面板

- Tabs: 时间线 / 概览
- 时间线: 按时间倒序, 每条显示时间/触发者/统计
- 概览: 总计统计 + 章节热力图
- 底部: 回退到初始版本 + 导出带修订 DOCX

## 验收标准

- AC7.1~AC7.8: 内联 Diff 标记
- AC8.1~AC8.6: 修订操作
- AC9.1~AC9.4: 修订时间线面板

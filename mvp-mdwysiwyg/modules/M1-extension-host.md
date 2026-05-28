# M1: extension-host

> **类型**: 后端 (Extension Host)  
> **依赖**: 无  
> **优先级**: P0

## 边界

Extension Host 端所有逻辑：Markdown 解析、Diff 计算、修订记录 CRUD、文件 I/O、WebView Provider 注册。

## 文件范围

- `src/extension/index.ts` — 插件入口
- `src/extension/providers/webviewProvider.ts` — CustomTextEditorProvider
- `src/extension/services/markdownParser.ts` — markdown-it 解析
- `src/extension/services/diffEngine.ts` — Diff 算法
- `src/extension/services/revisionManager.ts` — 修订记录 CRUD
- `src/extension/services/fileWatcher.ts` — 文件变更监听
- `src/extension/commands.ts` — 命令注册
- `src/extension/types/index.ts` — 类型定义

## 接口

### markdownParser

```typescript
parse(content: string): { tokens: Token[]; headings: Heading[] }
serialize(doc: ProseMirrorJSON): string  // AST → Markdown
```

### diffEngine

```typescript
computeDiff(v0: string, v1: string): { changes: DiffChange[]; stats: DiffStats }
```

### revisionManager

```typescript
load(filePath: string): RevisionStore
save(filePath: string, store: RevisionStore): void
setBase(filePath: string, content: string): RevisionStore
clearBase(filePath: string): RevisionStore
acceptChange(filePath: string, changeId: string): RevisionStore
rejectChange(filePath: string, changeId: string): RevisionStore
acceptAll(filePath: string): RevisionStore
rejectAll(filePath: string): RevisionStore
```

### webviewProvider

处理所有 WebView ↔ Extension 消息（参见 api-contract.yaml）。

## 数据表

无数据库。修订记录存储在 `.{filename}.revisions.json` 文件中。

## 验收标准

- AC16.1: 以 Heading token 为锚点拆分章节块
- AC16.2: 块内按文本相似度匹配段落
- AC16.3: 表格按行列对齐
- AC16.4: 代码块整体比较
- AC16.5: 未匹配段落标记为整体删除或插入
- AC16.6: 修订记录持久化到 JSON
- AC17.1: 修订记录存储为 `.{filename}.revisions.json`
- AC17.2: 关闭文件后再打开，修订标记自动恢复
- AC17.3: 接受/拒绝操作实时更新持久化文件
- AC10.1: 设为基准
- AC10.2: 更换基准文件
- AC10.3: 清除基准

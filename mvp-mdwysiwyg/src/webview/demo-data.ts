import type { Heading, Revision, DiffChange, DiffStats } from './types/index';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
}

function h(level: number, text: string, children: Heading[] = []): Heading {
  return { id: slugify(text), level, text, children };
}

export const demoHeadings: Heading[] = [
  h(1, 'Markdown 所见即所得阅读器 — 需求规格', [
    h(2, '一、背景与定位', [
      h(3, '1.1 痛点场景', [
        h(4, '三个核心痛点', [
          h(5, '不可视'),
          h(5, '改了什么不知道'),
          h(5, '找不到位置'),
        ]),
      ]),
      h(3, '1.2 竞品对比'),
      h(3, '1.3 产品定义'),
    ]),
    h(2, '二、整体架构', [
      h(3, '2.1 三面板布局'),
      h(3, '2.2 技术分层'),
    ]),
    h(2, '三、核心功能（三个面板）', [
      h(3, '3.1 左侧：大纲导航'),
      h(3, '3.2 中间：所见即所得主视图', [
        h(4, '① 两种主视图模式'),
        h(4, '② 卡片嵌套渲染规格'),
        h(4, '③ 非标题元素渲染规则'),
        h(4, '④ WYSIWYG 编辑'),
        h(4, '⑤ 内联 Diff 标记渲染'),
      ]),
      h(3, '3.3 右侧：修订历史'),
    ]),
    h(2, '四、交互设计', [
      h(3, '4.1 工具栏'),
      h(3, '4.2 快捷键'),
    ]),
    h(2, '五、技术设计', [
      h(3, '5.1 Diff 引擎'),
      h(3, '5.2 双向同步挑战'),
      h(3, '5.3 技术栈选型'),
      h(3, '5.4 与 kf-markdown-to-docx 的关系'),
    ]),
    h(2, '六、工程规范', [
      h(3, '6.1 文件命名约定'),
      h(3, '6.2 优先级矩阵'),
      h(3, '6.3 明确不做'),
    ]),
    h(2, '七、Mermaid 实时渲染示例', [
      h(3, '7.1 流程图'),
      h(3, '7.2 时序图'),
      h(3, '7.3 子图 (Subgraph)'),
    ]),
  ]),
];

// Rich body content keyed by heading text
export const demoBodies: Record<string, string> = {
  'Markdown 所见即所得阅读器 — 需求规格': '<p>本文档定义了 <strong>Markdown WYSIWYG Reader</strong> 插件的完整需求规格。该插件为 Qoder/Trae IDE 扩展，提供 Typora 级所见即所得阅读体验、Word 级修订追踪、以及结构化大纲导航。</p><blockquote><p>核心理念：让 AI 生成的 Markdown 文档在 IDE 内即可视化阅读、可追溯变更、可结构化导航。</p></blockquote>',
  '一、背景与定位': '<p>我让 AI 生成/改写了一段 Markdown。打开文件，看到的是：</p><p>这些 <code>### *** ---</code> 在纯文本编辑器里全是噪音。</p><p><strong>三个核心痛点</strong>：<span class="diff-insert">可视化阅读</span>、<span class="diff-insert">变更可追溯</span>、<span class="diff-delete">快速定位</span></p>',
  '1.1 痛点场景': '<p>三个核心痛点：</p><ul><li><strong>不可视</strong> — Markdown 语法符号干扰阅读</li><li><strong><span class="diff-modify">改了什么不知道</span></strong> — AI/人工修改后不知道哪句话变了</li><li><strong>找不到位置</strong> — 只能手动滚动</li></ul>',
  '1.2 竞品对比': '<table><tr><th>工具</th><th>能渲染</th><th>能编辑</th><th>有修订标记</th><th>有大纲</th><th>集成在 IDE</th></tr><tr><td>Typora</td><td>✅</td><td>✅</td><td>❌</td><td>✅</td><td>❌</td></tr><tr><td>VS Code 预览</td><td>✅</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td></tr><tr><td>Word/WPS</td><td>❌</td><td>✅</td><td>✅</td><td>✅</td><td>❌</td></tr><tr><td><strong>本插件</strong></td><td>✅</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr></table>',
  '1.3 产品定义': '<p>一个 Qoder/Trae 插件，打开 .md 文件时展示 <strong>Typora 级所见即所得视图</strong>，左侧大纲导航，中间正文<strong>修订标记直接渲染在文字上</strong>（<span class="diff-insert">绿增</span>/<span class="diff-delete">红删</span>/<span class="diff-modify">橙改</span>），右侧修订时间线面板。</p>',
  '2.1 三面板布局': '<p>对标 Word 审阅模式 + Typora 所见即所得，插件打开后在 IDE 右侧/新标签页展示三面板布局。</p><pre><code>┌──────────────────────────────────────────────────┐\n│ 左侧大纲 │       中间主视图          │ 右侧修订  │\n│   240px  │   所见即所得正文          │   280px   │\n└──────────────────────────────────────────────────┘</code></pre>',
  '2.2 技术分层': '<table><tr><th>层</th><th>运行时</th><th>职责</th></tr><tr><td>渲染+编辑层</td><td>WebView (HTML/CSS/JS)</td><td>Markdown 解析渲染、WYSIWYG 编辑、Mermaid 图表、diff 标记叠加</td></tr><tr><td>数据+diff层</td><td>Node.js / WASM</td><td>文件读写、V0 vs V1 diff 算法、修订记录管理</td></tr><tr><td>导出层（可选）</td><td>Python</td><td><span class="diff-insert">一键导出为带模板的 DOCX</span></td></tr></table>',
  '3.1 左侧：大纲导航': '<p>对标 Word "导航窗格" + Typora 大纲。</p><ul><li>点击节点 → 平滑滚动</li><li><span class="diff-modify">拖拽节点 → 移动标题及子内容</span></li><li>搜索过滤</li></ul>',
  '3.2 中间：所见即所得主视图': '<p><strong>核心原则</strong>：零原始标记、内联 diff、卡片嵌套。</p><p>两种模式：<strong>Word 流式视图</strong> 和 <strong>卡片嵌套视图</strong>（默认）。</p>',
  '① 两种主视图模式': '<table><tr><th>模式</th><th>效果</th><th>适用</th></tr><tr><td><strong>Word 流式视图</strong></td><td>连续排版，标题→段落→表格自然流动</td><td>日常阅读、长文浏览</td></tr><tr><td><strong>卡片嵌套视图</strong>（默认）</td><td>每个标题及所属内容渲染为独立 Card</td><td>结构化文档</td></tr></table>',
  '② 卡片嵌套渲染规格': '<p>基于 shadcn 的 Card 组件规范，每个标题层级渲染为嵌套卡片：</p><ul><li>H1: <code>ml-0 p-6 shadow-sm border</code>，标题 48px/800w</li><li>H2: <code>ml-4 p-4 border + left 3px primary</code>，标题 36px/700w</li><li>H3: <code>ml-8 p-3 border-b + left 2px muted-fg</code>，标题 24px/600w</li></ul>',
  '③ 非标题元素渲染规则': '<table><tr><th>元素</th><th>渲染效果</th></tr><tr><td><code>**加粗**</code></td><td>直接渲染粗体</td></tr><tr><td><code>`行内代码`</code></td><td>浅灰底 + 等宽字体</td></tr><tr><td>表格</td><td>shadcn Table 风格</td></tr><tr><td>代码块</td><td>深色背景 + 语法高亮 + 复制按钮</td></tr></table>',
  '④ WYSIWYG 编辑': '<p>像 Typora 一样——<strong>点击哪里就编辑哪里，立即看到渲染结果</strong>。</p><blockquote><p>编辑模式 vs 修订模式：当开启修订追踪时，编辑操作自动标记为修订；当关闭修订追踪时，编辑直接覆盖。</p></blockquote>',
  '⑤ 内联 Diff 标记渲染': '<p>当加载了基准版本并开启修订追踪后，中间视图原位叠加 diff 标记：</p><ul><li><span class="diff-insert">新增文字：绿色下划线 + 左侧绿色竖线</span></li><li><span class="diff-delete">删除文字：红色删除线 + 左侧红色竖线</span></li><li><span class="diff-modify">修改文字：橙色背景高亮 + 左侧橙色竖线</span></li></ul>',
  '3.3 右侧：修订历史': '<p>对标 Word "审阅窗格"。始终停靠右侧，可折叠。</p><ul><li>按时间倒序排列</li><li><span class="diff-insert">回退到初始版本</span></li></ul>',
  '5.1 Diff 引擎': '<p>流程：<code>MD(V0) → 解析为 Token 树 → 按标题对齐章节 → 逐段 diff → 叠加修订标记</code></p><pre><code>interface DiffResult {\n  stats: { inserted: number; deleted: number; modified: number }\n  changes: DiffChange[]\n}</code></pre>',
  '5.2 双向同步挑战': '<p>这是最难的部分。策略：</p><ol><li><strong>Markdown AST 是唯一真相源</strong></li><li>用户在 WebView 中编辑 → 实时更新 AST → 反向生成 Markdown → 写回 .md 文件</li><li>外部修改 → 重新解析 → 增量更新 DOM</li></ol>',
  '5.3 技术栈选型': '<table><tr><th>层</th><th>技术</th></tr><tr><td>Markdown 解析</td><td><code>marked</code> / <code>markdown-it</code></td></tr><tr><td>WYSIWYG 编辑</td><td><span class="diff-insert">prosemirror 或自研方案</span></td></tr><tr><td>Diff 算法</td><td><code>diff</code> (npm)</td></tr></table>',
  '5.4 与 kf-markdown-to-docx 的关系': '<p>日常使用不依赖 DOCX。导出功能仅在<span class="diff-modify">"导出正式交付物"</span>场景被调用。</p>',
  '6.2 优先级矩阵': '<p><strong>P0</strong>：三面板、渲染、编辑、Mermaid、Diff、大纲。<br><strong>P1</strong>：卡片嵌套、大纲拖拽、修订时间线、接受/拒绝、导出 DOCX。<br><strong>P2</strong>：变更热力图、AI 辅助、暗色主题。</p>',
  '6.3 明确不做': '<ul><li>❌ 独立 Web 应用</li><li>❌ 实时多人协作</li><li>❌ Git 版本控制</li><li>❌ 移动端适配</li></ul>',
  '三个核心痛点': '<p>当前 Markdown 工作流存在三个核心痛点：</p><ol><li><strong>不可视</strong> — 原始语法符号干扰阅读</li><li><strong>改了什么不知道</strong> — AI/人工修改后无法快速识别变更</li><li><strong>找不到位置</strong> — 长文档缺乏可视化导航</li></ol>',
  '不可视': '<p>Markdown 源文件充斥 <code>#</code>、<code>*</code>、<code>```</code>、<code>---</code> 等语法标记，阅读体验远不如渲染后的效果。</p>',
  '改了什么不知道': '<p>当 AI 或协作者修改文档后，用户只能通过 Git diff 查看变更，但 Git diff 基于行级别，无法直观展示<span class="diff-modify">语义级别</span>的变更。</p>',
  '找不到位置': '<p>长文档缺乏可视化导航，用户只能通过滚动条或 <code>Ctrl+F</code> 搜索定位目标章节。</p>',
  '二、整体架构': '<p>插件采用 <strong>Extension Host + WebView</strong> 双层架构，对标 VS Code Custom Editor 模式。Extension Host 负责文件 IO 和 diff 计算，WebView 负责渲染和编辑。</p>',
  '三、核心功能（三个面板）': '<p>三个面板分别对标：Word 导航窗格（大纲）、Typora 主编辑区（WYSIWYG）、Word 审阅窗格（修订历史）。</p>',
  '四、交互设计': '<p>交互设计遵循"最小点击、最大信息"原则，所有高频操作可通过工具栏或快捷键完成。</p>',
  '4.1 工具栏': '<p>工具栏分为四组：</p><ul><li><strong>文件组</strong>：打开、刷新、编辑切换、新增标题</li><li><strong>视图组</strong>：卡片/流式切换</li><li><strong>修订组</strong>：显示修订、全接受、全拒绝</li><li><strong>工具组</strong>：基准版本、导出 DOCX、设置</li></ul>',
  '4.2 快捷键': '<table><tr><th>快捷键</th><th>功能</th></tr><tr><td><code>Ctrl+S</code></td><td>保存文档</td></tr><tr><td><code>Ctrl+Z</code></td><td>撤销</td></tr><tr><td><code>Ctrl+B</code></td><td>加粗</td></tr><tr><td><code>Ctrl+I</code></td><td>斜体</td></tr><tr><td><code>Ctrl+Shift+V</code></td><td>切换视图模式</td></tr></table>',
  '六、工程规范': '<p>工程规范确保代码质量和团队协作一致性。</p>',
  '6.1 文件命名约定': '<ul><li>组件文件：PascalCase（如 <code>MdCard.vue</code>）</li><li>工具函数：camelCase（如 <code>usePanelResize.ts</code>）</li><li>样式文件：kebab-case（如 <code>globals.css</code>）</li><li>类型文件：统一在 <code>types/index.ts</code></li></ul>',
  '7.1 流程图': '<p>一个简单的流程图：</p><div class="mermaid-container"><div class="mermaid">graph TD\n  A[开始] --> B{判断}\n  B -->|是| C[处理A]\n  B -->|否| D[处理B]\n  C --> E[结束]\n  D --> E</div></div>',
  '7.2 时序图': '<p>登录时序图：</p><div class="mermaid-container"><div class="mermaid">sequenceDiagram\n  participant U as 用户\n  participant A as 应用\n  participant S as 服务器\n  U->>A: 输入密码\n  A->>S: POST /login\n  S-->>A: 返回 token\n  A->>U: 显示首页</div></div>',
  '7.3 子图 (Subgraph)': '<p>带子图的流程图：</p><div class="mermaid-container"><div class="mermaid">graph TB\n  subgraph 前端\n    A[UI组件] --> B[状态管理]\n  end\n  subgraph 后端\n    C[API路由] --> D[数据库]\n  end\n  B --> C\n  D --> E[响应]</div></div>',
};

export const demoRevisions: Revision[] = [
  {
    id: 'rev1',
    timestamp: '2026-05-27T14:30:00.000Z',
    triggerer: 'ai',
    changes: [
      { id: 'dc1', type: 'insert', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, newText: '可视化阅读', elementType: 'paragraph', accepted: false },
      { id: 'dc2', type: 'insert', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, newText: '变更可追溯', elementType: 'paragraph', accepted: false },
      { id: 'dc3', type: 'delete', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, oldText: '快速定位', elementType: 'paragraph', accepted: false },
    ],
    stats: { inserted: 128, deleted: 45, modified: 6 },
    status: 'pending',
  },
  {
    id: 'rev2',
    timestamp: '2026-05-27T10:15:00.000Z',
    triggerer: 'human',
    changes: [
      { id: 'dc4', type: 'modify', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, oldText: '改了什么不知道', newText: '改了什么不知道', elementType: 'paragraph', accepted: false },
    ],
    stats: { inserted: 12, deleted: 3, modified: 1 },
    status: 'pending',
  },
  {
    id: 'rev3',
    timestamp: '2026-05-26T09:00:00.000Z',
    triggerer: 'ai',
    changes: [
      { id: 'dc5', type: 'insert', position: { sectionId: '22-技术分层', line: 0, column: 0 }, newText: '一键导出为带模板的 DOCX', elementType: 'table-cell', accepted: false },
      { id: 'dc6', type: 'modify', position: { sectionId: '53-技术栈选型', line: 0, column: 0 }, oldText: 'prosemirror 或自研方案', elementType: 'table-cell', accepted: false },
    ],
    stats: { inserted: 450, deleted: 0, modified: 0 },
    status: 'pending',
  },
];

// All diff changes from all revisions (flat list for the document store)
export const demoDiffChanges: DiffChange[] = [
  { id: 'dc1', type: 'insert', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, newText: '可视化阅读', elementType: 'paragraph', accepted: false },
  { id: 'dc2', type: 'insert', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, newText: '变更可追溯', elementType: 'paragraph', accepted: false },
  { id: 'dc3', type: 'delete', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, oldText: '快速定位', elementType: 'paragraph', accepted: false },
  { id: 'dc4', type: 'modify', position: { sectionId: '11-痛点场景', line: 0, column: 0 }, oldText: '改了什么不知道', elementType: 'paragraph', accepted: false },
  { id: 'dc5', type: 'insert', position: { sectionId: '22-技术分层', line: 0, column: 0 }, newText: '一键导出为带模板的 DOCX', elementType: 'table-cell', accepted: false },
  { id: 'dc6', type: 'modify', position: { sectionId: '53-技术栈选型', line: 0, column: 0 }, oldText: 'prosemirror 或自研方案', elementType: 'table-cell', accepted: false },
];

export const demoContent = `# Markdown 所见即所得阅读器 — 需求规格
## 一、背景与定位
### 1.1 痛点场景
#### 三个核心痛点
##### 不可视
##### 改了什么不知道
##### 找不到位置
### 1.2 竞品对比
### 1.3 产品定义
## 二、整体架构
### 2.1 三面板布局
### 2.2 技术分层
## 三、核心功能（三个面板）
### 3.1 左侧：大纲导航
### 3.2 中间：所见即所得主视图
#### ① 两种主视图模式
#### ② 卡片嵌套渲染规格
#### ③ 非标题元素渲染规则
#### ④ WYSIWYG 编辑
#### ⑤ 内联 Diff 标记渲染
### 3.3 右侧：修订历史
## 四、交互设计
### 4.1 工具栏
### 4.2 快捷键
## 五、技术设计
### 5.1 Diff 引擎
### 5.2 双向同步挑战
### 5.3 技术栈选型
### 5.4 与 kf-markdown-to-docx 的关系
## 六、工程规范
### 6.1 文件命名约定
### 6.2 优先级矩阵
### 6.3 明确不做
## 七、Mermaid 实时渲染示例
### 7.1 流程图
### 7.2 时序图
### 7.3 子图 (Subgraph)
`;

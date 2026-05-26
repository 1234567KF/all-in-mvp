# Module: frontend — Dashboard 前端
<!-- @version: 1.0.draft -->
<!-- @status: DRAFT -->

## 1. 模块职责边界

### 做什么
- Pipeline 状态总览面板（状态标签、事件计数、Stage 进度条）
- 事件时间线视图（按时间排序，可滚动加载更多）
- 多维度过滤面板（Stage/Agent/EventType/时间范围/关键词搜索）
- 事件详情弹窗（展示完整 event 数据 + 格式化 JSON metadata）
- 统计图表展示（事件类型饼图、Stage 耗时柱状图、Agent 活跃度柱状图）
- 自动刷新（Pipeline RUNNING 时每 3 秒轮询）

### 不做什么
- 不做多 Pipeline 对比视图
- 不做移动端响应式（仅桌面 ≥1280px）
- 不做暗黑模式
- 不做数据导出

## 2. 依赖的其他模块

| 依赖模块 | 依赖原因 |
|---------|---------|
| pipeline (API) | 通过 `/api/pipelines/current` 获取当前 Pipeline 状态 |
| event (API) | 通过 `/api/events` 和 `/api/stats/*` 获取事件数据和统计 |

## 3. 所属领域

**前端展示**

## 4. 接口清单（API 依赖）

前端调用以下后端 API：

| API | 用途 | 组件 |
|-----|------|------|
| GET /api/pipelines/current | 获取当前 Pipeline 状态 | DashboardOverview, App |
| GET /api/events?pipeline_id=X&... | 时间线 + 过滤查询 | TimelineView, FilterPanel |
| GET /api/stats/overview | 概览统计 | DashboardOverview |
| GET /api/stats/stage-duration | Stage 耗时 | StatsCharts |
| GET /api/stats/agent-activity | Agent 活跃度 | StatsCharts |

## 5. 组件树

```
App.vue
├── DashboardOverview.vue      # 顶部状态面板
│   ├── Pipeline 状态标签
│   ├── 事件总数
│   ├── Stage 进度条
│   └── 自动刷新开关
├── FilterPanel.vue            # 左侧过滤面板
│   ├── Stage 下拉选择器
│   ├── Agent 下拉选择器
│   ├── EventType 多选
│   ├── 时间范围选择器
│   └── 关键词搜索框
├── TimelineView.vue           # 中央时间线
│   ├── EventItem (列表项)
│   └── 分页 / 加载更多
├── EventDetailModal.vue       # 事件详情弹窗
│   ├── 事件基本信息
│   └── JSON metadata 格式化展示
└── StatsCharts.vue            # 底部统计图表
    ├── 事件类型饼图
    ├── Stage 耗时柱状图
    └── Agent 活跃度柱状图
```

## 6. 验收标准

### Happy Path
| 场景 | Given | When | Then |
|------|-------|------|------|
| Dashboard 加载 | 后端有活跃 Pipeline + 若干事件 | 打开 Dashboard | 显示 Pipeline 状态、事件总数、时间线列表 |
| 时间线过滤 | Dashboard 已加载 | 选择 Stage=Stage3 | 时间线仅显示 Stage3 事件 |
| 关键词搜索 | Dashboard 已加载 | 输入 "ERROR" 搜索 | 时间线过滤出 message/metadata 含 "ERROR" 的事件 |
| 事件详情 | 时间线有事件 | 点击某条事件 | 弹出详情面板，显示完整信息+JSON |
| 自动刷新 | Pipeline RUNNING | 等待 3 秒 | 时间线自动追加新事件 |
| 统计图表 | 已有事件数据 | 滚动到 StatsCharts | 显示饼图 + 柱状图 |

### Exception Path
| 场景 | Given | When | Then |
|------|-------|------|------|
| 无活跃 Pipeline | 后端无 Pipeline 记录 | 打开 Dashboard | 显示"无运行中的流水线"空状态 |
| 时间线无事件 | Pipeline 存在但无事件 | 打开 Dashboard | 时间线显示"暂无事件"空状态 |
| 过滤无结果 | 选择不存在的组合条件 | 过滤 | 时间线显示"无匹配结果" |

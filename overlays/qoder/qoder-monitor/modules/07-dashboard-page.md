# M07: dashboard-page — 前端看板页面

## 模块职责

- **做什么**: 实现 F-005（实时看板展示）的前端页面，包含汇总卡片、轮次明细表、模型分布、优化节省展示区域，支持自动轮询刷新和交互筛选
- **不做什么**: 不包含会话管理界面（归 M08），不处理报告生成（归 M05）

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M04 | 必须 | dashboard-api 提供看板数据 |

## 领域标注

- **领域**: 业务核心
- **类型**: 前端 (Page)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `frontend/src/views/dashboard/Dashboard.vue` | 主看板页面容器，5秒轮询 |
| `frontend/src/views/dashboard/SummaryCards.vue` | 8 个汇总卡片 |
| `frontend/src/views/dashboard/TurnTable.vue` | 轮次明细表格，含筛选 |
| `frontend/src/views/dashboard/ModelDist.vue` | 模型分布展示 |
| `frontend/src/views/dashboard/Savings.vue` | 优化节省展示 |
| `frontend/src/stores/dashboard.ts` | Pinia store: 看板数据状态管理 |
| `frontend/src/api/dashboard.ts` | API 调用封装 |
| `frontend/src/components/EmptyState.vue` | 空态组件 |

## 设计规范

- **主题**: 深色主题
- **布局**: 顶部汇总卡片行 → 中间统计图表区 → 底部轮次明细表
- **刷新**: 每 5 秒通过 API 轮询，不依赖 WebSocket

## 组件清单

### Dashboard.vue（主页面）
- 页面容器，生命周期管理
- 5 秒定时轮询 GET /api/dashboard/summary
- 子组件编排：SummaryCards → ModelDist → Savings → TurnTable

### SummaryCards.vue（汇总卡片）
8 个卡片，每行 4 个：
1. 总调用次数 — 数值
2. 总输入 Token — 格式化 K/M
3. 缓存命中率 — 百分比 (>50% 绿色)
4. 总输出 Token — 格式化 K/M
5. 模型切换次数 — warn 样式
6. 模型数 — good 样式
7. 估算总成本 — ¥X.XXXX
8. 优化节省 Token — 绿色高亮

### TurnTable.vue（轮次明细表）
Element Plus el-table，字段：
- ID（等宽字体）、类型（标签徽章）、方向（文本+图标）、模型（彩色标签）、阶段
- 输入未命中/缓存/输出（右对齐数值，K/M 格式化）
- 估算成本（货币格式）、优化节省（绿色文本）

**筛选区域**:
- 模型筛选 — el-select 下拉
- 类型筛选 — el-select（全部/轮次/A2A）
- 关键词搜索 — el-input（匹配 ID/Agent/角色/阶段）

### ModelDist.vue（模型分布）
展示各模型调用次数和占比，卡片式网格布局

### Savings.vue（优化节省）
各机制节省 Token 展示，有数据绿色，无数据灰色，model_switch 虚线分隔

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-010 | 无数据时 | 显示 EmptyState "暂无数据 — 发送消息后自动出现" |
| BR-011 | 模型无定价 | 成本列显示"无定价" |
| BR-012 | 缓存率 > 50% | 卡片显示绿色样式 |

## 验收标准

### Happy Path
- AC-005: 页面加载展示所有汇总卡片，数值正确
- 模型筛选下拉正常过滤表格行
- 类型筛选按 turn/a2a 正确过滤
- 关键词搜索按 ID/Agent/角色/阶段模糊匹配
- 页面每 5 秒自动刷新，数据更新
- 空数据时显示友好提示

### Exception Path
- 后端 API 返回错误时，页面不崩溃，显示错误提示
- 网络超时不影响下次轮询（使用 catch 处理）

---

**【锁定版】** 已通过 Grill 审查

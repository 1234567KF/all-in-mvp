# M08: session-manager — 前端会话管理

## 模块职责

- **做什么**: 实现 F-006（会话筛选与切换），提供会话列表展示和会话切换功能，支持按会话 ID 筛选看板数据
- **不做什么**: 不包含看板主页面（归 M07），不处理数据聚合（归 M03/M04）

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M07 | 必须 | dashboard-page 提供主看板容器 |

## 领域标注

- **领域**: 业务核心
- **类型**: 前端 (Component)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `frontend/src/views/sessions/SessionList.vue` | 会话列表组件 |
| `frontend/src/stores/session.ts` | Pinia store: 当前选中会话状态 |
| `frontend/src/api/sessions.ts` | API 调用封装 |

## API 依赖

| API | 用途 |
|-----|------|
| GET /api/sessions | 获取所有会话列表 |
| GET /api/sessions/:id | 获取单个会话详情 |
| GET /api/sessions/:id/stats | 获取指定会话的统计 |

## 交互设计

### 会话列表
Element Plus el-table，字段：
| 字段 | 类型 | 展示形式 | 说明 |
|------|------|---------|------|
| 会话 ID | string | 可点击文本 | 点击切换当前会话 |
| 轮次数量 | integer | 右对齐数值 | turn_count |
| A2A 数量 | integer | 右对齐数值 | a2a_count |
| 创建时间 | datetime | YYYY-MM-DD HH:mm:ss | created |
| 最后活跃 | datetime | YYYY-MM-DD HH:mm:ss | last_activity |

### 会话切换流程
1. 用户点击某会话行
2. session Pinia store 更新当前 session_id
3. Dashboard 主页面检测到 session_id 变更
4. 重新调用 GET /api/dashboard/summary?session_id=<id>
5. 看板数据自动切换到该会话

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-013 | IF 指定 session_id 不存在 THEN 显示"会话不存在" | 展示空态，不报错 |
| F-006 相关 | 无 session 参数时展示全量数据 | 默认展示所有会话汇总 |

## 验收标准

### Happy Path
- AC-006: 会话列表正确展示（ID、轮次数、A2A 数、创建时间、最后活跃）
- 点击会话行成功切换看板视图
- 切换后看板数据仅展示该会话的数据

### Exception Path
- 不存在的 session_id 显示空态并提示"会话不存在"
- 没有会话记录时列表为空，显示引导信息

---

**【锁定版】** 已通过 Grill 审查

# M05: report-gen — 报告生成

## 模块职责

- **做什么**: 实现 F-010（Markdown 报告生成）和 F-011（HTML 独立看板生成），基于数据库数据生成可导出、可离线查看的报告文件
- **不做什么**: 不处理实时数据展示（归 M04/M07），不处理数据采集（归 M02）

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M01 | 必须 | db-core 提供数据库查询 |
| M03 | 必须 | stats-api 提供统计数据和成本计算 |

## 领域标注

- **领域**: 工具与配置
- **类型**: 后端 (Service)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `backend/src/services/report/markdown.ts` | Markdown 报告生成 |
| `backend/src/services/report/html.ts` | HTML 独立看板生成 |

## 接口清单

无 API 端点（内部 Service 模块）。由命令行或程序调用触发。

### F-010: Markdown 报告

**触发方式**: `perf-tracker report [--session <id>]`

**报告结构**:
1. Overview — 概览统计（总调用、Token 汇总、成本、节省）
2. Per-Turn Breakdown — 轮次明细表
3. Token Savings — 优化节省明细
4. Cost Estimate — 成本估算详情

**文件路径**: `.qoder-flow/perf/perf-report-<session>.md`

### F-011: HTML 独立看板

**触发方式**: `perf-tracker web [--session <id>]`

**功能要求**:
- 内嵌 CSS + JavaScript，独立 HTML 文件
- 支持模型筛选（下拉）
- 支持类型筛选（全部/轮次/A2A）
- 支持关键词搜索（模糊匹配）
- 深色主题

**文件路径**: `.qoder-flow/perf/perf-dashboard-<session>.html`

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-020 | IF 目标目录不存在 THEN 自动创建 | 首次生成时自动创建 |
| BR-021 | IF 无 turn 记录 THEN 生成空态报告 | 提示"暂无数据" |

## 验收标准

### Happy Path
- AC-010: Markdown 报告生成正确
  - 包含 Overview、Per-Turn Breakdown、Token Savings、Cost Estimate 4 个章节
  - 文件格式正确，可在 Markdown 查看器中正常渲染
- AC-011: HTML 看板生成正确
  - 独立可打开，无需服务器
  - 筛选功能正常（模型/类型/搜索）
  - 样式与 Live Dashboard 一致

### Exception Path
- 目标目录不存在时自动创建，不报错
- 数据库无数据时生成空态 HTML/报告

---

**【锁定版】** 已通过 Grill 审查

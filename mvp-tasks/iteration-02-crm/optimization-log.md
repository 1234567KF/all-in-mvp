# 迭代2优化记录：CRM系统 + API契约与Mock一致性

## 优化角度（新）
**Mock-后端框架一致性** — 解决前端Mock与后端真实API行为不一致导致的联调bug

## 发现的问题
- Mock服务器用 Express，后端用 Hono → 中间件行为不同（CORS、错误处理、请求解析）
- Mock的响应格式与后端不一致 → 前端代码在联调时需要修改
- Error Code 字符串不匹配 → 前端错误处理逻辑失效
- 缺少自动化验证 Mock 和真实后端一致性的机制

## 优化内容

### 1. kf-mvp-mock-service/SKILL.md
- **Express → Hono 全面迁移**：所有路由、中间件、错误处理改为 Hono 风格
- **统一CORS配置**：与后端完全相同的 origin/headers/methods
- **统一响应格式**：`c.json({success, data/error}, status)` 与后端一致
- **Hono 错误处理**：`app.onError` + `app.notFound` 替代 Express 中间件

### 2. kf-mvp-api-contract/SKILL.md
- **新增 Mock-后端一致性验证章节**：自动化测试确保两者行为一致
- **一致性验证清单**：7个维度（响应格式/状态码/Error Code/字段类型/分页/CORS/延迟）
- **自动化验证脚本**：并行请求 Mock 和真实后端，对比响应结构和状态码
- **Error Code 强制匹配**：`expect(mockJson.error.code).toBe(realJson.error.code)`

## CRM系统需求
- 客户管理（增删改查、标签、分类）
- 联系人跟踪（沟通记录、跟进状态）
- 销售漏斗（线索→商机→成交）
- 任务提醒（待办、日历）

## 产出物
- api-contract.yaml: 统一契约
- mocks/: Hono Mock服务器
- tests/contract-consistency.test.ts: 一致性验证

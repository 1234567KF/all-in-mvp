# Playbook — 血案库

> **用途**：按需查阅，不占用 Agent 上下文。每个血案对应一条 gate-rules.yaml 中的规则。
> **查阅方式**：Agent 遇到规则违反时，Coordinator 引用血案 ID 告知后果。

---

## v2.14 血案

### B014 — fetchChannelOptions() 静默失败
- **规则**：R015 禁止静默吞错误
- **现象**：前端调用 `fetchChannelOptions().catch(() => {})`，端点 `/channels/options` 不存在，渠道下拉永远为空，无任何错误提示
- **排查**：数小时才发现路径根本不存在——代码中静默吞掉了 404 错误
- **教训**：`.catch(() => {})` 空回调 = 定时炸弹。至少 `console.warn(err)`

### B013 — /channels/options 端点不存在
- **规则**：R014 API 端点存在性交叉校验
- **现象**：前端 services/x.ts 中写了 `/channels/options`，但所有后端路由表（Mock + 真实）都没有这个路径
- **根因**：前端 Agent 自行发明了路径，contract-drift-log 只看已有条目变更，不会发现新增的私有路径
- **教训**：Stage 4.2 联调前必须扫描前端所有 api.xxx() 调用，与 contract/Mock/routes 交叉比对

### B012 — 渠道下拉无选项
- **规则**：R013 UI 数据加载路径必测
- **现象**：API 测试全绿，但人工点击"创建客户"弹窗，渠道下拉为空
- **根因**：API 层测试通过的端点 ≠ UI 组件能拿到数据。下拉渲染依赖的是另一条 API 调用链
- **教训**：@headed E2E 必须覆盖弹窗下拉选项渲染验证

---

## v2.13 血案

### B011 — E2E 92/92 全绿但真实后端登录失败
- **规则**：R009 E2E 双模验收
- **现象**：E2E 92 条用例全部通过，交付后人工启动真实 SQLite 后端，快捷登录立即报"密码错误"
- **根因**：所有 E2E 跑在内存 Mock 服务器上。Mock 的密码验证逻辑与真实 bcrypt 完全不同
- **教训**：E2E 必须跑 Mock + Real 两轮，只跑 Mock = 假绿色

### B010 — Mock 7 个账号、真实 DB 只种了 1 个
- **规则**：R010 种子数据单一真源
- **现象**：Mock 数据有 7 个测试账号，真实 SQLite 只 seed 了 1 个 admin，前端快捷登录按钮全部失效
- **根因**：Mock 数据和 DB seed 脚本各自维护了两份独立的账号列表
- **教训**：种子数据必须存在 `seeds/` 目录，Mock 和 DB 共享同一份 import

### B009 — 端口 5173 → 5177 漂移
- **规则**：R011 端口配置化
- **现象**：Vite 端口从 5173 自动漂移到 5177，E2E 配置的 baseURL 还是 5173，所有测试超时
- **根因**：端口硬编码在各处配置文件，`.env` 未定义标准端口
- **教训**：统一从 `.env` 读取 API_PORT/WEB_PORT，禁止硬编码

### B008 — services/roles.ts 全部 404
- **规则**：R012 API 路径唯一真源
- **现象**：前端 services/roles.ts 按 Mock 服务器的路径约定编写，切到真实后端后全部 404
- **根因**：Mock 路由 `/api/roles/list` vs 真实后端 `/api/roles`——两套路由完全不同
- **教训**：api-contract.yaml 是唯一路径真源，前端和 Mock 都必须从 contract 提取路径

---

## v2.12 血案

### B007 — "已审核商机仍在待审核列表"
- **规则**：R007 状态双向断言
- **现象**：审核通过后，商机从"待审核"消失 → E2E 断言通过。但实际仍在待审核列表显示
- **根因**：只断言了 target 出现，没断言 source 消失
- **教训**：每次状态转换必须双向断言

### B006 — partner-flow 只用一个账号测试
- **规则**：R006 权限交叉矩阵必测
- **现象**：所有 partner 流程测试都用同一个 partner 账号，数据隔离 bug 完全未暴露
- **教训**：必须生成角色×端点矩阵，每个格 = 1 条用例

### B005 — 搜索框无反应、编辑表单未预填
- **规则**：R005 E2E 浏览器交互配额
- **现象**：E2E 用例 80% 是 API 直调，浏览器交互极少，表单下拉空白、搜索无效等 UI bug 全部漏网
- **教训**：E2E spec 文件中 page.fill/click/goto 占比必须 ≥ 30%

---

## v2.8 血案

### B004 — axios 双重包裹 res.data.data.list
- **规则**：R001 响应格式标准化
- **现象**：后端返回 `{ data: [...] }`，前端期望 `{ data: { list, total } }`，axios 再加一层 `.data`，读取路径变成 `res.data.data.list`
- **教训**：必须统一 `{ data: { list, total } }` 格式

### B003 — 前端写 type:'company'，后端只接受 z.enum(['enterprise','individual'])
- **规则**：R002 枚举值唯一真源
- **现象**：纯 API 测试不可见（测试直接拼正确值），真实浏览器操作才触发 400
- **教训**：枚举值从 contract/schema 提取，严禁前端自行发明

### B002 — Vite proxy 遗漏 partner 路由
- **规则**：R003 E2E 必须穿透代理层
- **现象**：E2E 直连后端端口全绿，浏览器访问 404——proxy 配置遗漏了 partner 前缀
- **教训**：E2E 必须通过 Vite proxy 访问后端

---

## 如何新增血案

1. 在对应版本段落下新增 `### B0XX — 简短标题`
2. 填写：规则引用 → 现象 → 根因 → 教训
3. 关联 gate-rules.yaml 中的 rule ID

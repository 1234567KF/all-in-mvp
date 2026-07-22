# 多Agent并行开发复盘总结

> 基于微点CRM全流程开发中的实际故障案例，提炼反模式、根因与改进建议，用于优化技能提示词。

---

## 一、契约漂移（Contract Drift）—— 最高频故障模式

### 案例 1.1：枚举值不一致
**现象**：前端提交 `type: "company"`，后端 Zod 只接受 `z.enum(["企业","个人"])`，返回 400 校验错误。

**根因**：前后端 Agent 各自独立定义了枚举值列表，没有共享同一个"唯一真源"。

**修复**：将枚举值定义从 Zod schema 提取到 api-contract.yaml，前后端代码生成阶段都从契约文件读取。

**改进建议**：
- Skill 中强制要求 api-contract.yaml 包含所有枚举值的完整定义
- 代码生成 prompt 明确："枚举值必须从契约文件读取，不得硬编码"
- Stage 3 DONE 门禁增加枚举值一致性校验脚本

### 案例 1.2：响应格式不一致
**现象**：后端返回 `{ data: [...] }` 裸数组，前端期望 `{ data: { list: [...], total: N } }`，导致表格渲染空白。

**根因**：后端 Agent 按自己习惯的格式返回，前端 Agent 按另一套习惯解析。

**修复**：统一响应信封为 `{ success: boolean, message: string, data: T }`，列表接口 data 内固定为 `{ list: T[], total: number }`。

**改进建议**：
- api-contract.yaml 中明确定义每个接口的响应 shape 而非仅标注类型
- 添加 `response-shape-check` 脚本自动比对接口返回与契约定义

### 案例 1.3：axios 双重包裹
**现象**：后端返回 `{ success: true, data: { ... } }`，前端用 `api.post()` 后取 `res.data.data` 发现 `undefined`。

**根因**：axios 的 `response.data` 已等于响应 body。后端也是 `{ data: ... }` 格式，前端的 `res.data.data` 少了一层。实际数据在 `res.data.data`。

**改进建议**：
- 统一 api.ts 封装层：`api.post()` 直接返回 `response.data.data`，上层调用方不关心 axios 层级
- E2E 测试必须穿透 Vite proxy + axios 拦截器，不能直连后端 API 端口

---

## 二、模块间集成盲区（Integration Blind Spots）

### 案例 2.1：侧边栏未接入权限系统
**现象**：后端 `buildPermissions()` 正确返回了有限权限（ROLE-001 只有 6 项权限），但前端侧边栏仍然显示全部菜单项。

**根因**：权限系统分三层——后端返回权限数组（✅）、auth store 提供 `hasMenu()` 判断函数（✅）、侧边栏渲染层实际调用过滤（❌）。第三层从未被实现。

**诊断链路**：
```
buildPermissions() → user.menus ["dashboard","customer"] ✅
                ↓
hasMenu("system:account")  // 返回 false ✅  
                ↓
SidebarMenuContent  // 没调用 hasMenu() ❌  
```

**改进建议**：
- 模块间集成点（Integration Point）必须在设计阶段显式列出，分配唯一责任人
- 前端页面组件（Page）和布局组件（Layout）分属不同 Agent 开发时，约定接口合同
- 修复类 bug 的 prompt 应包含：**"检查该功能的完整数据流链路：数据层 → 判断层 → 渲染层"**

### 案例 2.2：UserMenu 硬编码用户信息
**现象**：所有用户（无论角色）在右上角下拉菜单都显示 "ADMIN" 和头像 "A"。

**根因**：UserMenu 组件用硬编码字符串代替从 auth store 读取动态数据。

**改进建议**：
- 所有显示当前用户信息的组件必须从 `useAuthStore` 读取，禁止硬编码
- 新增一个通用检查项：**"所有 UI 组件是否绑定了正确的数据源，而非静态假数据"**

### 案例 2.3：refreshAccessToken 使用过期用户数据
**现象**：页面刷新后 token 自动刷新，但用户数据使用的是登录时的缓存（旧数据），而非 `/auth/refresh` 返回的最新数据。

**根因**：`refreshAccessToken()` 中 `setAuth({ user: oldUser })`，忽略了 `/auth/refresh` 返回的 `user` 字段。

**改进建议**：
- 任何涉及认证状态变更的函数，优先使用服务器返回的最新数据
- 模式：**"客户端不是权威的数据源，服务器响应才是"**

---

## 三、数据类型不一致（Type Contract Breach）

### 案例 3.1：Dashboard 统计接口返回错误类型
**现象**：`GET /dashboard/stats` 返回 `statusDistribution: {"未跟进": 0, ...}`（对象），前端期望 `[{name: "未跟进", value: 0, color: "..."}]`（数组）。非 admin 用户还收到 `monthlyNew: 0`（数字）。

**根因**：后端 service 函数直接返回字面量对象而非转换后的数组格式，未与前端约定具体数据结构。

**修复**：后端改为从数据库实时聚合数据并返回数组格式。

**改进建议**：
- 契约文件不仅标注类型（Array/Object），还要标注**具体元素结构**和**边界情况**（空数组 vs null vs 对象）
- 明确约定：**列表类数据永远是 `[]`，永不返回 `null` 或 `{}`**

---

## 四、E2E 测试覆盖缺陷

### 案例 4.1：测试绕过前端真实路径
**现象**：客户渠道下拉菜单为空，但 E2E 测试未发现，因为测试直接传 `channelId` 值跳过了 UI 下拉选择步骤。

**根因**：E2E 测试用例设计为"功能通过即止"，没有覆盖 UI 数据加载路径。

**改进建议**：
- E2E 测试用例划分为两类：
  - **功能路径**（Happy Path）：验证完整业务流程
  - **数据加载路径**（Data Loading Path）：验证下拉菜单/表格/表单的数据源是否正常加载
- 新增检查点：**"任何 UI 选择器（Select/Dropdown/AutoComplete）都被视为一个独立的数据加载测试点"**

### 案例 4.2：Mock 与真实后端数据不一致
**现象**：Mock 模式下测试全部通过，切换到真实 SQLite 后端后快捷登录提示 "手机号或密码错误"。

**根因**：Mock 内存数据和真实数据库种子数据不同步——Mock 有 `13800000001`，SQLite 只有 `13800000000`。

**改进建议**：
- 同一项目禁止同时维护两套种子数据
- E2E 测试和人工验收必须运行在同一套后端（SQLite），严禁 Mock 替代
- 种子数据作为版本控制文件统一管理

### 案例 4.3：E2E 直连后端绕过胶水代码
**现象**：E2E 测试直连后端 3333 端口，未经过 Vite proxy（5555），导致 axios 拦截器、auth 中间件等胶水代码未被覆盖。

**改进建议**：
- E2E 测试 URL 必须指向前端端口（如 5555），通过 Vite proxy 到达后端
- CI/CD 中同时启动前端 + 后端服务作为测试目标

---

## 五、流程与技能层面的系统改进建议

### 5.1 Stage 门禁扩展

当前 Stage 3 DONE 门禁只检查"模块是否编译通过"。建议扩展：

| 门禁项 | 检查内容 | 触发时机 |
|--------|---------|---------|
| 契约合规检查 | 接口路径/方法/枚举/响应 shape 与 api-contract.yaml 一致 | Stage 3 DONE |
| 集成测试门禁 | 跨模块的 API 调用链测试覆盖 | Stage 3 DONE |
| 数据类型检查 | 前后端类型定义是否匹配 | Stage 3 DONE |
| E2E 数据加载路径 | 测试了所有 UI 下拉/表格的数据源 | Stage 4 开始前 |

### 5.2 Agent Prompt 改进建议

**前端 Agent**：
- 每次创建页面/组件时，检查是否有对应的后端 API 端点存在
- 所有和权限相关的地方，必须通过 `useAuthStore.hasMenu()` 访问，不假设用户角色
- 所有显示用户信息的地方，必须从 auth store 读取，禁止硬编码

**后端 Agent**：
- 所有枚举值在 api-contract.yaml 中定义，不要自行创造
- 列表接口统一返回 `{ list: T[], total: number }`，永不返回裸数组
- 数值/数组字段用 `[]` 和 `0` 作为空值，不用 `null` 或 `undefined`

**后端→前端通信契约**：
- 响应信封固定 `{ success, message, data }`
- 列表 data 固定 `{ list, total }`
- 枚举值在 api-contract.yaml 中是唯一真源
- 空数组用 `[]`，空对象用 `{}`，数值默认用 `0`

### 5.3 集成点清单（Integration Point Checklist）

所有跨模块功能必须显式列出集成点：

```
功能：权限菜单
├── 数据层：  buildPermissions() → user.menus          [后端Agent]
├── 存储层：  auth store.user.menus                     [store Agent]
├── 判断层：  hasMenu(menuKey)                          [store Agent]
└── 渲染层：  SidebarMenuContent 过滤菜单项             [Layout Agent] ← 必须有过滤逻辑
```

### 5.4 修复类任务 Prompt 模式

修复 bug 时，prompt 应包含：

```
1. 定位问题所在的功能模块和数据链路
2. 检查完整链路：数据源 → 中间层 → UI 渲染
3. 列出所有受影响的文件
4. 修复后验证：静态编译 + 运行时检查
```

---

## 六、数据汇总

| 案例 | 类型 | 涉及模块 | 发现方式 |
|------|------|---------|---------|
| 渠道枚举值不匹配 | 契约漂移 | 后端 Zod + 前端表单 | 手动操作报 400 |
| 响应格式不匹配 | 契约漂移 | 后端 + 前端 DataTable | 表格空白 |
| axios 双重包裹 | 契约漂移 | api.ts 拦截器 | 数据 undefined |
| Dashboard 类型错误 | 数据类型 | 后端 service | 前端渲染崩溃 |
| 侧边栏无权限过滤 | 集成盲区 | 前端 Layout | 用户反馈 |
| UserMenu 硬编码 | 集成盲区 | 前端组件 | 用户反馈 |
| refreshToken 旧数据 | 集成盲区 | api.ts 刷新逻辑 | Code Review |
| 种子数据不一致 | E2E 缺陷 | 多环境数据源 | 登录失败 |
| E2E 直连后端 | E2E 缺陷 | 测试框架 | 漏测 |
| 缺少 API 端点 | E2E 缺陷 | 后端 + E2E | UI 空数据 |

---

*生成日期：2026-07-21*
*基于微点CRM MVP Stage 3/4 全流程开发复盘*

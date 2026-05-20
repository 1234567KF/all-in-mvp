---
name: kf-mvp-prd-generator
description: >-
  Load when user asks to create, generate, draft, or write a PRD for MVP
  projects. Triggers: PRD, 产品需求文档, 需求分析, 写PRD, 创建PRD,
  深度PRD, deep PRD. NOT for: production system design, architecture
  decisions, or tech stack selection (use kf-mvp-arch-expert).
metadata:
  pattern: inversion + generator
  domain: mvp-stage1
  complexity: high
  anti_laziness: structured-enforcement
recommended_model: pro
graph:
  dependencies:
    - target: all-in-mvp
      type: semantic
    - target: kf-mvp-arch-expert
      type: conditional
---

# Evals

## Positive (MUST trigger)
- "帮我写个PRD"
- "生成产品需求文档"
- "深度PRD"
- "创建PRD"

## Negative (MUST NOT trigger)
- "设计系统架构" → kf-mvp-arch-expert
- "选技术栈" → kf-mvp-arch-expert
- "写代码" → kf-mvp-backend-tdd / kf-mvp-frontend-dev
- "修复bug" → kf-mvp-debug

---

# Gotchas

1. **深度PRD结构优先** — 本 Skill 采用 8 维度统一功能表结构，确保功能需求完整性。任何维度缺失 = PRD 不合格。
2. **MVP 技术栈默认锁定** — 除非用户显式覆盖，否则 MUST 使用 Hono + Drizzle + SQLite + Vue 3 + Vite。禁止在 PRD 中引入 Redis、消息队列、限流等 MVP 豁免组件。
3. **SDD Excel 路由** — 检测到 SDD 模板时 MUST 跳过 Q2-Q8，直接加载 `references/sdd-excel-parsing-rules.md`。
4. **Phase 0 未完成不得生成** — Q1-Q8 未全部回答前，禁止进入 Phase 1。
5. **功能需求是灵魂** — 8 维度任何一个缺失 = PRD 不合格，必须返回修改。
6. **空单元格零容忍** — 不允许任何空单元格或"—"占位符。
7. **术语一致性** — Chapter 2 定义后全文统一，禁止混用同义词。
8. **业务线独立** — 每条业务线 MUST 独立成节，禁止合并。
9. **人/AI 标记强制** — PRD 全文 MUST 标注 🔴🟡🟢，不允许缺失。
10. **Gate 机械化验证** — 所有 Gate 项 MUST 逐条自检，禁止口头判断"没问题"。

---

# MVP PRD Generator — 深度PRD生成技能

> **Core Belief**: A good PRD forces completeness by design. The feature table is the single source of truth — merging business rules, interactions, and functional requirements into one unified per-page specification that AI cannot skim.
**Division of Labor**: This Skill focuses on **structured requirements collection** (Inversion pattern) + **unified feature table output** (Generator pattern). Agent plays interviewer first, then synthesizes into a PRD where each feature block contains all 8 mandatory dimensions.

---

# Core Philosophy

1. **Feature table = single source of truth** — One feature = one block with 8 dimensions. No dimension is optional.
2. **Anti-laziness by design** — Structured format makes omissions visible and painful. AI cannot hide incomplete content across scattered chapters.
3. **MECE requirements** — Mutually exclusive, collectively exhaustive
4. **Default tech stack enforced** — Unless user explicitly overrides: Hono + Drizzle + SQLite + Vue 3 + Vite
5. **Lock after review** — PRD is locked after passing review; changes require change request process
6. **kf-prd-deep 优先** — 所有 PRD 结构、格式、规则与 kf-prd-deep 保持一致；本 Skill 仅追加 MVP 约束

---

# Default Tech Stack (MUST enforce unless user explicitly overrides)

Load `references/mvp-tech-stack-default.md` for full specification.

**Backend**: Node.js + Hono + Drizzle ORM + SQLite (better-sqlite3) + JWT + Zod
**Frontend**: Vue 3 + Vite + Pinia + Vue Router + Axios + UI Framework (6选1)
**Testing**: Vitest + Playwright
**Third-party**: ALL Mock (payment/sms/storage/push)

**MVP Exemptions** (explicitly NOT included): Redis, message queue, rate limiting, CDN, cache strategy, XSS/CSRF (beyond JWT), logging system, monitoring, performance optimization, concurrency control.

If user requests tech stack changes → ask for explicit confirmation, document in PRD Section 3.2.

---

# Phase 0 — Requirements Interview (Inversion Phase)

Ask one question at a time. Wait for each answer. Do NOT generate any PRD content until all questions are answered.

- **Q1**: "请提供需求来源（@file 引用：口述记录/Excel/Word/文档均可），以及项目名称是什么？"

### SDD Routing

After Q1, if user provided `.xlsx` file, **MUST immediately check if it's an SDD requirements collection Excel template** (ReadMe Sheet first line contains `SDD需求采集模板`, and Sheet names follow `SheetN-ChineseName` format):

- **Is SDD template**: Load `references/sdd-excel-parsing-rules.md`, extract Sheet1 (project basics) and Sheet14 (AI instruction config) data, **skip Q2-Q8 verbal questions**, proceed directly to Phase 0.5 for cross-validation with SDD data
- **Not SDD template**: Continue with Q2-Q8 verbal questions

- **Q2**: "目标用户角色有哪些？请逐一列出角色名称和职责简述。"
- **Q3**: "项目涉及几条独立的业务线？（如：电商销售、营销活动、财务对账可以是三条独立业务线）。每条业务线的核心流程是什么？"
- **Q4**: "核心业务实体有哪些？（如：订单、用户、商品、工单）。这些实体之间存在什么关系？"
- **Q5**: "哪些功能模块属于复杂/核心业务？（涉及多角色协作、复杂状态流转、跨模块数据联动的模块）"
- **Q5a**: "本期页面有哪些类型？请按页面维度分类：哪些是列表型页面、哪些是表单型页面/弹窗、统计型页面（含图表/仪表盘）、特殊页面（非标准布局）？统计型页面涉及哪些统计维度和计算指标？特殊页面的特殊之处在哪？"
- **Q6**: "技术约束有哪些？（后端框架、前端框架、UI组件库、数据库）"
- **Q6a**: "系统的数据权限控制模型是怎样的？（如：角色级数据隔离、部门级数据隔离、全系统共享、行级数据权限）哪些数据实体需要权限控制？"
- **Q7**: "本期明确不做的事项（Out of Scope）？"
- **Q8**: "有哪些关键术语需要统一定义？"

### Phase 0.5 — Project Context Auto-Detection

After collecting answers, MUST auto-scan workspace dependency files:

| 扫描目标 | 文件 | 提取内容 |
|---------|------|---------|
| 前端 | `package.json` | 框架版本、UI组件库名称+版本、构建工具 |
| 后端 | `package.json` | 框架版本、Hono/Drizzle/SQLite 版本 |

输出技术约束对照表：

| 维度 | 检测值 | 来源文件 | 用户回答 | 状态 |
|------|--------|---------|---------|------|

检测值与用户回答不一致 → 向用户确认。用户回答模糊 → **以 MVP 默认技术栈为准**（Hono + Drizzle + SQLite + Vue 3 + Vite）。

### Gate 0 — DO NOT proceed to Phase 1 until all Phase 0 questions (Q1–Q8 + Q5a/Q6a) are answered AND Phase 0.5 is confirmed.

---

# Phase 1 — PRD Generation

Load `references/prd-template.md` for the chapter structure. Then execute the following steps in order. Each step fills one chapter.

### Step 1: Fill Chapter 1 — 项目背景

Output sections:
1. **业务目标**：回答"为什么做"，至少一个量化指标
2. **目标用户角色**：表格（角色 | 描述 | 核心诉求）
3. **产品类型判定**：B2C/B2B/内部工具/平台型，输出判定结果

### Step 2: Fill Chapter 2 — 术语定义

| 术语 | 英文 | 定义 | 备注 |
|------|------|------|------|

所有 Q8 收集的术语 MUST 出现在此表。PRD 中后续所有章节 MUST 使用统一定义的术语，禁止混用同义词。

### Step 3: Fill Chapter 3 — 风险与约束

Output four sub-sections:
- **3.1 业务风险**：至少列出 3 条业务层面风险（如需求变更、第三方依赖、合规要求）
- **3.2 技术约束**：从 Phase 0.5 对照表填充。**MVP 默认技术栈已锁定，除非用户显式覆盖**：
  | 维度 | 约束 | 版本号 |
  |------|------|--------|
  | 后端框架 | Hono | 4.x |
  | 前端框架 | Vue 3 | 3.4+ |
  | UI 组件库 | [6选1，见 references/mvp-tech-stack-default.md] | - |
  | 数据库 | SQLite (better-sqlite3) | 11.x |
  | ORM | Drizzle ORM | 0.36+ |
  | 构建工具 | Vite | 5.x |
  | 测试框架 | Vitest | 2.x |
- **3.3 Out of Scope**：逐条列出 Q7 的不做事项
- **3.4 合规约束**（条件章节）：仅当项目涉及监管合规（如 GDPR、等保、行业准入）时输出

### Step 4: Fill Chapter 4 — 业务主流程

按 Q3 的业务线分别输出。每条业务线：
- 流程编号（FLOW-XX）
- 流程名称
- 涉及角色
- 流程步骤表（阶段 | 角色 | 操作 | 产生的数据）
- 若涉及多角色协作，输出跨角色泳道图（Mermaid flowchart LR 或 graph TB）

**铁律**：每条业务线 MUST 独立成节。禁止将多条业务线混在一起写成一个大流程。

### Step 5: Fill Chapter 5 — ER关系

从 Q4 的核心实体出发，输出：
- **实体列表**：实体名 | 含义 | 主要属性（3-5个）
- **实体关系图**：Mermaid erDiagram
- **关系说明表**：实体A | 关系 | 实体B | 业务约束

### Step 6: Fill Chapter 6 — 功能需求（核心章节）

> **CRITICAL**: This is the soul of the PRD. If this chapter is thin, the entire PRD fails. You MUST fill every dimension for every feature.

**6.0 功能清单**：在输出详细功能块之前，MUST 先生成完整的功能清单层级表。

| 客户端 | 一级模块 | 二级功能 | 三级功能 | 对应页面 | 对应按钮/操作 |
|--------|---------|---------|---------|---------|-------------|

**组织原则**：按页面/模块组织。同一个页面的所有功能点放在一起。每个功能点是一个完整的规格块，包含以下 **8 个强制维度**。

在每个模块/页面下，对每个功能点输出以下结构：

```
#### F-XXX 功能名称 `P0|P1|P2`

**维度1 — 描述**（≥30字符，禁止"管理XX"等泛化短语）：
_详细描述该功能做什么、为什么需要、以及与其他功能的关联。_

**维度2 — 验收标准**（Gherkin Given-When-Then 格式）：
Scenario: AC-XXX - 场景描述
  Given 前置条件
  When 用户操作
  Then 系统响应 (Frontend/Backend)

**维度3 — 业务规则**（IF-THEN 格式，至少1条/功能，P0功能至少2条）：
| 规则编号 | 规则描述 (IF-THEN) | 违反时处理 | 前置条件 |

**维度4 — 交互模式**（用户操作 → 系统响应，至少2步/功能）：
| 步骤 | 用户操作 | 系统响应 | 备注 |

**维度5 — 状态流转**（如涉及状态 MUST 输出，否则写"不适用 — 无状态流转"）：
- 状态列表
- 状态流转图（Mermaid stateDiagram-v2）
- 状态-操作-权限映射表

**维度6 — 字段规格**（当功能涉及页面时强制输出。按页面类型输出对应规格表）：
- 列表型页面：查询字段表 + 列表字段表 + 操作按钮表
- 表单型页面/弹窗：表单字段表（含输入类型/数据来源/必填/校验/条件显示/联动/3态差异）
- 统计型页面：统计字段表 + 筛选条件与图表联动
- 特殊页面：页面布局描述/交互方式/特殊说明
- 字段规格输入类型枚举、校验规则格式、联动规则格式详见 `references/field-spec-rules.md`

**维度7 — 数据校验规则**（所有功能强制，至少2条）：
| 校验对象 | 校验类型 | 校验规则 | 错误提示 | 校验位置 |
|---------|---------|---------|---------|---------|

**维度8 — 数据权限**（条件维度：涉及多角色/行级隔离时强制输出，否则写"不适用 — 全系统共享"）：
| 数据范围 | 可见角色 | 可操作角色 | 权限粒度 | 说明 |
|---------|---------|----------|---------|------|
```

**功能需求完整性强制规则** — MUST 逐功能自检。加载 `references/feature-table-integrity-rules.md` 获取完整规则与反偷懒示例。

| 检查项 | 标准 | 不通过处理 |
|--------|------|-----------|
| 描述字数 | ≥30 字符，不含"管理XX"等泛化短语 | 重写描述 |
| 验收标准格式 | Gherkin Scenario 格式，Given/When/Then 齐全 | 补充验收标准 |
| 业务规则数量 | P0 功能 ≥ 2条，P1 功能 ≥ 1条，P2 功能 ≥ 0条 | 补充规则 |
| 业务规则格式 | IF-THEN 格式，含违反时处理方式 | 补全规则 |
| 交互步骤数量 | ≥ 2步（用户操作→系统响应） | 补充交互步骤 |
| 状态流转 | 涉及状态→必须输出 Mermaid 图+映射表；不涉及→写明"不适用" | 补充状态说明 |
| 空单元格 | 不允许任何空单元格或"—"占位符 | 填充具体内容 |
| 字段规格完整性 | 列表页→查询+列表+按钮表齐全；表单页→全字段属性+3态差异；统计页→计算逻辑+展示形式+筛选联动 | 补充字段规格 |
| 数据校验规则 | 每功能≥2条，含校验类型+规则表达式+错误提示+校验位置 | 补充校验规则 |
| 数据权限 | 涉及多角色/行级隔离→输出权限表；全系统共享→写"不适用" | 补充权限说明 |

### Step 6.5: 页面类型归类与字段级规格输出

在 Chapter 6 所有功能块生成完成后，执行页面类型归类。参考 Q5a 的回答，将每个页面归类为列表型/表单型/统计型/特殊页面之一，并按页面维度输出完整的字段级规格总表。

**字段级规格总表格式**（每类页面独立一张总表）：

- **列表型页面字段总表**：字段名 | 字段类型 | 前端表现形式 | 列表展示 | 查询可用 | 数据校验规则 | 备注
- **表单型页面字段总表**：字段名 | 字段类型 | 输入类型 | 数据来源 | 必填 | 校验规则 | 条件显示规则 | 联动规则 | 新增态 | 编辑态 | 查看态 | 说明
- **统计型页面字段总表**：统计字段名 | 计算逻辑 | 展示形式 | 筛选条件 | 联动图表 | 说明
- **特殊页面说明**：页面名称 | 页面布局描述 | 交互方式 | 特殊说明

> 字段规格的完整性要求和输入类型枚举规范，见 `references/field-spec-rules.md`。

### Step 7: Fill Chapter 7 — 复杂/核心业务专题

仅对 Q5 指定的复杂/核心业务模块输出。每个模块一个专题，包含：

1. **功能来源与渠道分析**：数据从哪来（用户录入/设备采集/第三方推送/系统计算）
2. **使用角色及其职责**：该模块涉及的所有角色及操作边界
3. **完整操作流程**：按阶段拆解（准备→执行→校验→后续）
4. **状态流转说明**：完整状态机图 + 状态-操作-权限映射表（含异常回退路径）
5. **数据关联关系**：上游关联 + 下游关联
6. **数据流转关系总图**：Mermaid graph/flowchart
7. **页面字段汇总**：筛选条件、列表字段、表单字段、详情字段
8. **报表统计**（如适用）：统计维度+使用场景
9. **智能规则/默认匹配逻辑**（如适用）：条件→规则→说明

### Step 8: Fill Chapter 8 — 复杂/核心实体状态图

对 Q4/Q5 中涉及复杂状态的实体，逐个输出：
- 状态列表（所有可能状态）
- 状态流转图（Mermaid stateDiagram-v2，含所有转换条件和异常回退）
- 状态-操作-权限映射表（状态 | 可执行操作 | 操作人 | 触发条件 | 下一状态）
- 状态变更副作用（如：进入"已结束"状态后不可编辑、自动发送通知等）

### Step 9: Fill Chapter 9 — 验收标准（集成测试级别）

与 Chapter 6 的单功能验收标准不同，本章输出**跨功能的集成测试场景**。

**Happy Path**（至少覆盖每条业务线的端到端流程）：
```gherkin
Scenario: INT-HP-001 - 业务线名称 - 场景描述 (P0)
  Given 系统配置完成
  And 用户已登录具备相应权限
  When 用户执行完整业务流程（步骤1→步骤2→步骤3）
  Then 每个步骤的结果符合预期 (Frontend)
  And 数据在各模块间正确传递 (Backend)
```

**Exception Path**（至少覆盖：权限不足、数据冲突、外部依赖失败、边界值、并发操作）：
```gherkin
Scenario: INT-EP-001 - 异常场景描述 (P0)
  Given 前置条件
  And 异常条件
  When 触发异常操作
  Then 错误提示符合预期 (Frontend)
  And 系统状态回滚/不变 (Backend)
  And 错误码为 "ERROR_CODE" (Backend)
```

**覆盖门禁**：
- Happy Path ≥ 业务线数量 × 1
- Exception Path ≥ 5
- 每个 Then/And MUST 标注 (Frontend) 或 (Backend)

**9.2 异常处理与边界值表**：

输出每张页面的异常场景与边界值定义。加载 `references/exception-boundary-rules.md` 获取完整规则。

| 编号 | 异常场景描述 | 边界值定义 | 预期处理方式 | 对应功能点 |
|------|------------|-----------|-------------|-----------|

**覆盖门禁**：
- 每张页面 ≥ 5 条异常处理记录
- 边界值定义 MUST 覆盖：最大输入长度、数值范围（含上界/下界）、特殊字符、空值、枚举越界
- 异常场景 MUST 覆盖：权限不足、数据冲突、外部依赖失败、格式非法、并发操作

### Step 10: 人/AI 关注点标记

在 PRD 所有章节内容生成完成后，对全文进行关注点标记：

- **🔴 人重点关注**：业务决策、产品方向定义、验收标准判定、风险判断
- **🟡 AI实现参考**：技术约束、字段规格表、数据校验规则、状态流转
- **🟢 人/AI共同**：术语定义、业务主流程、ER关系、功能需求

在每个章节标题后追加标记符号。

### Step 11: Output Complete PRD

Write the PRD to file. Path rules:
1. **User specified path** → Use user's path
2. **No specification** → Suggest: `docs/PRD.md`
3. Output path, wait for user confirmation before writing

---

# Phase 2 — Quality Gates

PRD 生成完成后，MUST 逐项自检：

| # | 检查项 | 判断标准 | 不通过处理 |
|---|--------|---------|-----------|
| 1 | 术语一致性 | 全文使用 Chapter 2 定义的术语，无同义词混用 | 统一术语 |
| 2 | 业务线独立性 | 每条业务线独立成节，流程不混杂 | 拆分业务线 |
| 2.5 | 功能清单覆盖率 | 6.0 功能清单 MUST 覆盖所有 6.1~6.N 的功能点 | 补充功能清单 |
| 3 | 功能需求描述质量 | 所有功能描述 ≥30 字符，无"管理XX"泛化短语 | 重写描述 |
| 4 | 功能需求验收标准 | 所有功能有 Gherkin 验收标准，Given/When/Then 齐全 | 补充验收标准 |
| 5 | 功能需求业务规则 | P0 功能 ≥2 条规则，P1 功能 ≥1 条，规则格式 IF-THEN | 补充规则 |
| 6 | 功能需求交互模式 | 所有功能 ≥2 步交互，用户操作→系统响应格式 | 补充交互 |
| 7 | 功能需求状态流转 | 涉及状态→有 Mermaid 图+映射表；不涉及→明确标注 | 补充状态 |
| 8 | 功能需求空单元格 | 无任何空单元格或"—"占位符 | 填充内容 |
| 9 | 复杂专题完整性 | 复杂模块专题含 9 个子章节 | 补充专题 |
| 10 | 实体状态图完整性 | 所有含状态的实体有完整状态图+映射表 | 补充状态图 |
| 11 | 集成测试 Happy Path | ≥ 业务线数量 条端到端场景 | 补充场景 |
| 12 | 集成测试 Exception Path | ≥ 5 条异常场景，覆盖 5 种类型 | 补充场景 |
| 13 | ER 关系完整 | 所有核心实体在 ER 图中出现，关系有业务约束说明 | 补充关系 |
| 14 | 风险不少于 3 条 | 业务风险 ≥ 3 条 | 补充风险 |
| 15 | 字段规格完整性 | 列表页→查询+列表+按钮表齐全；表单页→全字段属性+3态差异；统计页→计算逻辑+展示形式+筛选联动 | 补充字段规格 |
| 16 | 数据校验规则 | 每功能≥2条校验规则，含校验类型+规则表达式+错误提示+校验位置 | 补充校验规则 |
| 17 | 数据权限完整性 | 涉及多角色/行级隔离→输出权限表；全系统共享→写"不适用" | 补充权限说明 |
| 18 | 异常处理与边界值 | 每页面≥5条记录，覆盖5种异常类型+4种边界值类型 | 补充异常/边界值记录 |
| 19 | 技术栈一致性 | PRD 中技术约束与 MVP 默认技术栈一致，或已记录用户显式覆盖 | 统一技术约束 |

任一项不通过 → 返回 Phase 1 修改对应章节，直到全部通过。

---

# 铁律

1. **Phase 0 未完成不得生成 PRD** — Q1-Q8 全部确认后进入 Phase 1
2. **功能需求是灵魂** — 任何功能点的任何维度缺失 = PRD 不合格
3. **功能需求反偷懒** — 不允许空单元格，不允许"—"占位，不允许泛化描述（"管理XX"）
4. **业务规则 MUST 使用 IF-THEN 格式** — 禁止"按照业务规则处理"等模糊描述
5. **所有涉及状态的功能/实体 MUST 输出 Mermaid stateDiagram-v2 状态图 + 状态-权限映射表**
6. **验收标准 MUST 使用 Gherkin Scenario 格式** — 每个 Then/And 标注 (Frontend)/(Backend)
7. **术语一经定义，全文统一** — 禁止"用户"和"会员"、"订单"和"工单"混用
8. **每条业务线独立成节** — 禁止合并不同业务线的流程
9. **不假设、不编造、不绕过** — 歧义立即停止提问，同一问题 2 次未解决标记阻塞项
10. **Gate 机械化验证** — 所有 Gate 项 MUST 逐条自检，禁止口头判断"没问题"
11. **页面级字段规格强制** — 每个页面 MUST 按类型输出字段级规格总表，不允许跳过
12. **异常与边界值强制** — 每页面 MUST 输出异常处理与边界值表，不允许省略
13. **人/AI 标记强制** — PRD 全文 MUST 标注 🔴🟡🟢 关注点，不允许缺失
14. **MVP 技术栈默认锁定** — 除非用户显式覆盖，否则 MUST 使用 Hono + Drizzle + SQLite + Vue 3 + Vite

---

# 常见反模式（AI 偷懒模式——否定式指令）

| 反模式 | 表现 | 正确做法 |
|--------|------|----------|
| 描述缩水 | 功能描述只写"管理XX信息"或"查看XX列表" | 描述必须 ≥30 字符，说明做什么+为什么+关联什么 |
| 规则黑洞 | 业务规则栏写"—"或留空，期待后续补充 | 每条 P0 功能 ≥2 条 IF-THEN 规则，P1 功能 ≥1 条 |
| 交互省略 | 交互模式只写"点击按钮→弹出弹窗"一步 | 每功能 ≥2 步完整交互，含加载/空/错误三态 |
| 状态跳过 | 功能涉及状态但写"不适用" | 只要实体有状态字段（即使只是启用/禁用），就必须输出状态图+映射表 |
| 验收标准空泛 | 验收标准写"功能正常"、"操作成功" | 必须 Gherkin 格式：Given X When Y Then Z |
| 业务线合并 | 将电商、营销、对账写成一个大流程 | 每条业务线 MUST 独立成节 |
| 术语混用 | 前文用"会员"，后文用"用户" | 第二章定义术语后全文统一 |
| 专题跳过 | 复杂模块标注了但专题章节为空 | 复杂模块 MUST 输出完整 9 子章节专题分析 |
| 状态图缺异常 | 状态图只有正常流转，无异常回退路径 | 状态图 MUST 包含异常回退（如审批驳回、校验失败） |
| 字段规格空洞 | 功能块中字段规格维度留空或写"见原型" | 按页面类型输出完整字段规格表 |
| 校验规则缺失 | 数据校验规则维度写"—"或只写"前端校验" | 每功能≥2条校验规则，含校验类型+规则表达式+错误提示+校验位置 |
| 边界值省略 | 异常处理表只写异常场景不写边界值 | 每条记录含最大输入长度、数值范围上限下限、特殊字符等边界值定义 |
| 标记遗漏 | 人/AI关注点标记不全或忘记标记 | Chapter 输出完成后按模板标记规则追加🔴🟡🟢 |
| 技术栈漂移 | PRD 中技术约束与 MVP 默认不一致，且未记录用户显式覆盖 | 统一为 MVP 默认技术栈，或要求用户确认覆盖 |

---

# 参考文件

| 文件 | 加载时机 | 用途 |
|------|---------|------|
| `references/prd-template.md` | Phase 1 Step 1 | PRD 文档标准模板（9章+条件章节结构） |
| `references/feature-table-integrity-rules.md` | Phase 1 Step 6 生成前 | 功能需求完整性强制规则（反偷懒清单） |
| `references/sdd-excel-parsing-rules.md` | Phase 0 SDD 路由（检测到 SDD Excel 时） | SDD 需求采集 Excel 结构化解析规则 |
| `references/field-spec-rules.md` | Phase 1 Step 6 / Step 6.5 | 字段规格完整性规则（输入类型枚举、校验格式、联动格式） |
| `references/exception-boundary-rules.md` | Phase 1 Step 9 | 异常处理与边界值完整性规则 |
| `references/mvp-tech-stack-default.md` | Phase 0.5 / Phase 1 Step 3 | MVP 极简技术栈默认约束 |

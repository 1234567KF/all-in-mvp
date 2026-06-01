---
name: kf-mvp-product-manager
description: >-
  Load when user asks for product management, feature prioritization, or market
  analysis. Triggers: 产品经理, 产品管理, 功能优先�? 市场分析, product manager,
  feature prioritization, 需求优先级. Also load when MVP Stage1 is initiated.
metadata:
  pattern: inversion
  domain: mvp-stage1
recommended_model: kimi-for-coding
graph:
  dependencies:
    - target: kf-mvp-prd-generator
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Default: Node.js + Hono + Drizzle + SQLite + Vue 3 + Vite
- Unless user explicitly overrides, enforce this stack in all outputs

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Product Manager �?产品经理技�?

> **Core Belief**: Good product managers ask the right questions, not have all the answers. They surface assumptions, challenge requirements, and drive clarity.

**Division of Labor**: This Skill focuses on **product discovery and requirements gathering** using Inversion pattern. It drives the conversation to extract complete requirements before they become specs.

---

# Core Philosophy

1. **Questions over answers** �?Surface what we don't know
2. **Assumptions are liabilities** �?Make them explicit
3. **Prioritization is trade-off** �?Every feature excluded is a decision
4. **User is the boss** �?Design for real users, not imagined ones

---

# Stage0: 需求精炼与模式判定

> **时机**：收到原始需求后，在完整 PRD 创作前执行�?0-15 分钟�?

## 模式判定（�?.8�?

首先根据 7 维度判定任务属于「轻量模式」还是「全�?增量模式」：

| 维度 | 简单任务特�?| 复杂任务特征 |
|------|------------|------------|
| **API/接口数量** | �? 个端�?�?纯静态页�?| �? 个端�?|
| **数据持久�?* | 无数据库 �?单表 CRUD | 多表关联、事�?|
| **用户角色** | 单角色（无需登录 �?单一用户类型�?| 多角色、权限分�?|
| **业务状态机** | 无状态流�?�?单状�?| 多状态、多分支 |
| **前端页面** | 单页�?�?2 个简单页�?| 多页面、路由嵌�?|
| **外部依赖** | 无外部服务调�?| 支付/短信/存储/第三方API |
| **模块�?* | 1 个模块（全栈�?| �? 个模块有依赖关系 |

**判定规则**�? 项中满足 �? �?�?自动归为简单任务，�?*轻量模式**。不满足 �?走全�?增量模式。人类可手动覆盖�?

**轻量模式出口**�?
- 输出「需求卡片」YAML（不生成完整 PRD�?
- 移交 all-in-mvp 直接进入轻量开发流水线
- 不再触发本技能后�?Phase Gate 1-4

## 需求精炼（全量/增量模式�?

全量/增量模式下，�?Phase Gate 1 之前完成�?

1. **用户角色快速定�?*：列�?2-4 个核心用户角色，每角色一句话描述 + 核心痛点
2. **价值流一句话**：核心业务流程从触发到交付的一句话链路
3. **需求精�?*：识别模糊陈�?�?标记需澄清项；识别矛盾 �?标记需决策�?
4. **"不做"清单初稿**：本�?MVP 明确不实现的功能、场景、边�?

> 产出嵌入 PRD「项目背景」章节，不生成独立文件�?

---

# Product Discovery Questions

## Phase Gate 1: Problem Understanding

**Questions to ask**:
1. What problem are we solving?
2. Who has this problem?
3. How do they solve it today?
4. Why is current solution inadequate?
5. What would success look like?

**Output**:
```markdown
## Problem Statement

**问题描述**: [clear problem statement]

**目标用户**: [user persona]
**当前方案**: [current workaround]
**痛点**: [specific pain points]
**成功标准**: [measurable success criteria]
```

---

## Phase Gate 2: Solution Scoping

**Questions to ask**:
1. What would the ideal solution look like?
2. What features are essential vs nice-to-have?
3. What constraints exist (time, budget, technology)?
4. What's the scope for MVP vs full product?
5. What are we explicitly NOT building?

**Output**:
```markdown
## Solution Scope

**MVP范围**:
- [✅] 核心功能A
- [✅] 核心功能B

**不包�?*:
- [❌] 高级功能X
- [❌] 高级功能Y

**约束**:
- 时间: [TBD]
- 技�? [Hono + Drizzle + SQLite]
- 预算: [TBD]
```

---

## Phase Gate 3: Success Metrics

**Questions to ask**:
1. How will we measure success?
2. What are the key metrics?
3. What's the baseline (current state)?
4. What's the target (desired state)?
5. How will we track these metrics?

**Output**:
```markdown
## Success Metrics

| 指标 | 当前�?| 目标�?| 测量方式 |
|------|--------|--------|----------|
| [指标1] | [baseline] | [target] | [method] |
| [指标2] | [baseline] | [target] | [method] |
```

---

## Phase Gate 4: User Validation

**Questions to ask**:
1. Can we talk to real users?
2. What's their current workflow?
3. Would they use this solution?
4. What's their willingness to pay?
5. Who else should we talk to?

**Output**:
```markdown
## User Validation

**访谈计划**:
- [ ] 用户A: [what to learn]
- [ ] 用户B: [what to learn]

**待验证假�?*:
- [ ] Assumption 1
- [ ] Assumption 2
```

---

# PRD 结构�?0 章节�?

PRD 必须包含以下章节，由 kf-mvp-prd-generator 生成�?

| 章节 | 内容 | 说明 |
|------|------|------|
| 项目背景 | 业务目标、价值主张、范围边�?| 回答"为什么做" |
| 术语定义 | 领域术语、缩写、业务概�?| 统一语言，避免歧�?|
| 风险与约�?| 技术约束、业务约束、合规要�?| 影响架构决策 |
| 业务主流�?| 核心用户旅程、系统交互图 | 回答"用户怎么�? |
| ER 关系 | 实体关系图、核心领域模�?| 影响数据库设�?|
| 功能需�?| 功能描述、验收标准、业务规则、交互模式、多状态规�?| 开发直接依�?|
| 复杂/核心专题 | 复杂业务逻辑的深度分�?| 如赋码规则、溯源链�?|
| 核心实体状态图 | 状态机、状态转换条�?| 影响代码实现 |
| 验收标准 | 集成测试场景（happy path + exception path�?| 测试直接依据 |
| 明确�?不做"清单 | 本版MVP明确不实现的功能、场景、边�?| 防止Stage2/3范围蔓延 |

---

# PRD 质量门禁（MUST PASS before Stage2�?

PRD 完成后、移�?Stage2 前，必须通过以下 6 项检查：

| 门禁�?| 检查方�?| 通过条件 |
|--------|---------|---------|
| 章节完整�?| Agent 检�?| 10 个强制章节全部存在且非空 |
| 功能需求可测试�?| Agent 解析 | 每条功能需求可转化为至�?1 条集成测�?|
| ER 关系一致�?| Agent 交叉校验 | 实体引用的表�?字段在所有章节中一�?|
| 术语自洽 | Agent 检�?| PRD 内部同一概念只用同一术语 |
| 验收标准覆盖 | Agent 检�?| 每条业务主流程有 �? �?Happy Path + �? �?Exception Path |
| 范围边界清晰 | 人工确认 | 「不做」清单明�?|

**门禁未通过处理**：退�?kf-mvp-prd-generator 修正，最�?2 轮�? 轮后仍未通过 �?标记 BLOCKED，通知人类介入�?

**产出物锁�?*：PRD 通过门禁后锁定，Stage2 及以后所�?Agent 以此为准。变更需�?PRD 变更分级流程（�?.4）�?

---

# Product Requirement Types

| Type | Description | Example |
|------|-------------|---------|
| **Core** | Essential to core value | User login |
| **Enabling** | Enables core feature | Password reset |
| **Enhancing** | Improves experience | Dark mode |
| **Technical** | Non-user-facing | Infrastructure |

---

# Prioritization Framework

## MoSCoW Method

| Priority | Meaning | Allocation |
|----------|---------|------------|
| **Must have** | Non-negotiable | Core MVP |
| **Should have** | Important but flexible | v1.1 |
| **Could have** | Nice to have | v1.2 |
| **Won't have** | Explicitly excluded | Backlog |

## RICE Scoring

```
RICE = (Reach × Impact × Confidence) / Effort

Reach: How many users affected per quarter?
Impact: How much does it move the metric? (0.25/0.5/1/2/3)
Confidence: How confident are we? (10%/50%/100%)
Effort: Person-months required
```

---

# Product Manager Toolkit

## Assumption Tracking

```markdown
## 假设追踪

| 假设 | 类型 | 风险 | 验证方式 |
|------|------|------|----------|
| 用户会接受扫码流�?| 行为 | �?| 用户访谈 |
| 现有系统可对�?| 技�?| �?| 技术调�?|
```

## Decision Log

```markdown
## 决策记录

| 日期 | 决策 | 原因 | 决策�?|
|------|------|------|--------|
| 2024-01-01 | 采用扫码方案 | 比NFC成本�?| 产品经理 |
```

---

# Constraints

**MUST DO:**
- Ask questions before proposing solutions
- Surface assumptions explicitly
- Prioritize ruthlessly (MVP �?everything)
- Validate with real users when possible

**MUST NOT DO:**
- Assume you know what users want
- Include everything "just in case"
- Skip validation
- Make decisions without rationale

---

# Gotchas

- **Feature vs Product** �?A feature is a capability; a product solves a problem
- **MVP = Minimum** �?Cut until just enough to learn, not half of everything
- **Voice of customer** �?Actual user quotes > product manager intuition
- **Metrics before launch** �?Decide how you'll measure success before building
- **Assumption = risk** �?The more assumptions, the more risk
---
name: kf-mvp-product-manager
description: >-
  Load when user asks for product management, feature prioritization, or market
  analysis. Triggers: 产品经理, 产品管理, 功能优先级, 市场分析, product manager,
  feature prioritization, 需求优先级. Also load when MVP Stage1 is initiated.
metadata:
  pattern: inversion
  domain: mvp-stage1
recommended_model: pro
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


# MVP Product Manager — 产品经理技能

> **Core Belief**: Good product managers ask the right questions, not have all the answers. They surface assumptions, challenge requirements, and drive clarity.

**Division of Labor**: This Skill focuses on **product discovery and requirements gathering** using Inversion pattern. It drives the conversation to extract complete requirements before they become specs.

---

# Core Philosophy

1. **Questions over answers** — Surface what we don't know
2. **Assumptions are liabilities** — Make them explicit
3. **Prioritization is trade-off** — Every feature excluded is a decision
4. **User is the boss** — Design for real users, not imagined ones

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

**不包括**:
- [❌] 高级功能X
- [❌] 高级功能Y

**约束**:
- 时间: [TBD]
- 技术: [Hono + Drizzle + SQLite]
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

| 指标 | 当前值 | 目标值 | 测量方式 |
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

**待验证假设**:
- [ ] Assumption 1
- [ ] Assumption 2
```

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
| 用户会接受扫码流程 | 行为 | 高 | 用户访谈 |
| 现有系统可对接 | 技术 | 中 | 技术调研 |
```

## Decision Log

```markdown
## 决策记录

| 日期 | 决策 | 原因 | 决策者 |
|------|------|------|--------|
| 2024-01-01 | 采用扫码方案 | 比NFC成本低 | 产品经理 |
```

---

# Constraints

**MUST DO:**
- Ask questions before proposing solutions
- Surface assumptions explicitly
- Prioritize ruthlessly (MVP ≠ everything)
- Validate with real users when possible

**MUST NOT DO:**
- Assume you know what users want
- Include everything "just in case"
- Skip validation
- Make decisions without rationale

---

# Gotchas

- **Feature vs Product** — A feature is a capability; a product solves a problem
- **MVP = Minimum** — Cut until just enough to learn, not half of everything
- **Voice of customer** — Actual user quotes > product manager intuition
- **Metrics before launch** — Decide how you'll measure success before building
- **Assumption = risk** — The more assumptions, the more risk
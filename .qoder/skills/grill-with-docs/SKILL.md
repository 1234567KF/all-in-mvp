---
name: grill-with-docs
description: >-
  Load when user asks to grill, cross-review, audit, or scrutinize architectural
  specs and business documents. Triggers: 拷问, 审查, 交叉校验, grill, cross-review,
  需求覆盖检查, 术语一致性, 验收标准对齐. Also load when PRD needs verification
  against spec.md or module docs.
metadata:
  pattern: reviewer + pipeline
  domain: mvp-quality-gate
graph:
  dependencies:
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# Grill-with-Docs — 拷问审查循环技能

> **Core Belief**: The only way to catch inconsistency between architectural specs and business requirements is to force them to confront each other. Grill relentlessly until all gaps are exposed.

**Division of Labor**: This Skill focuses on the **cross-verification workflow** — reading both sets of artifacts, running comparison checks, and generating actionable issue reports. File engineering conventions follow `references/file-engineering-spec.md`.

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.3 — the ↺ 拷问审查循环:

1. **Dual-position verification** — Same PRD as baseline, two different perspectives (① Architecture vs ② Business)
2. **No assumption of correctness** — Both ① and ② claim their outputs are valid; Grill forces proof
3. **Iterative until pass** — Loop until all four review dimensions pass, not until time runs out
4. **Actionable output** — Each finding must include: what's wrong, who fixes it, how to verify fix

---

# Four Review Dimensions

## Dimension 1: 需求覆盖完整性 (PRD Coverage)

**Question**: Does spec.md cover ALL functional requirements from PRD?

**Verification Method**:
- Read PRD "功能需求" section
- Read spec.md "接口清单" + schema.sql "表清单"
- Map each PRD requirement → corresponding API/table
- Report missing mappings

**Severity**: ERROR if any PRD requirement has no corresponding interface/table

---

## Dimension 2: 模块边界合理性 (Module Boundary)

**Question**: Do `<module>.md` interfaces/tables align with schema.sql + api-contract.yaml?

**Verification Method**:
- Read each `<module>.md` "接口清单" + "数据库表" sections
- Read api-contract.yaml routes and DTOs
- Check for:
  - Interface defined in module but not in api-contract
  - Table defined in module but not in schema.sql
  - Naming inconsistencies (e.g., `product_trace` vs `trace_records`)

**Severity**: ERROR if boundary mismatch found

---

## Dimension 3: 术语一致性 (Terminology Consistency)

**Question**: Does the same concept use the same term across all documents?

**Verification Method**:
- Build glossary from PRD "术语定义" section
- Scan spec.md, schema.sql, api-contract.yaml, and all `<module>.md`
- Flag any term variation:
  - "溯源码" vs "追踪码" vs "trace_code" vs "traceId"
  - "产品" vs "商品" vs "product" vs "goods"
  - "用户" vs "会员" vs "user" vs "customer"

**Severity**: WARNING — same concept must use consistent term

---

## Dimension 4: 验收标准对齐 (Acceptance Criteria Alignment)

**Question**: Does each `<module>.md` acceptance criteria fully cover corresponding PRD acceptance criteria?

**Verification Method**:
- Read PRD "验收标准" section
- Read each `<module>.md` "验收标准" section
- For each PRD acceptance criterion:
  - Does at least one module's acceptance criteria cover it?
  - Is the coverage complete (happy path + exception path)?
  - Is the test file location specified?

**Severity**: ERROR if PRD acceptance criterion has no module coverage

---

# Grill Workflow

## Phase Gate 0: Preparation

Before starting, confirm:
- [ ] PRD file path is known and accessible
- [ ] spec.md + schema.sql + api-contract.yaml path is known
- [ ] task.md + `<module>.md` files path is known
- [ ] All files are in "locked" state (not being actively edited)

**IF any file is missing**: Report BLOCKED with missing file path, DO NOT proceed.

---

## Phase Gate 1: 需求覆盖完整性 Check

1. Extract all functional requirements from PRD "功能需求" section
2. Extract all API endpoints from api-contract.yaml
3. Extract all tables from schema.sql
4. For each PRD requirement, find matching API/table
5. Report any requirement with NO match

**Output Format**:
```markdown
## 需求覆盖完整性检查结果

| PRD需求 | 对应API | 对应表 | 状态 |
|--------|--------|--------|------|
| 溯源码生成 | POST /api/trace/generate | trace_codes | ✅ |
| 用户登录 | POST /api/auth/login | users | ✅ |
| [新需求] | - | - | ❌ 未覆盖 |

**结论**: [PASS/FAIL] — [具体缺失项]
```

---

## Phase Gate 2: 模块边界合理性 Check

1. Read each `<module>.md` interface and table definitions
2. Cross-reference with api-contract.yaml and schema.sql
3. Flag mismatches

**Output Format**:
```markdown
## 模块边界合理性检查结果

| 模块 | 定义的接口 | API契约中的接口 | 状态 |
|------|----------|----------------|------|
| trace | POST /api/trace/generate | ✅ 存在 | ✅ |
| trace | POST /api/trace/assign | ❌ 缺失 | ❌ |

**结论**: [PASS/FAIL] — [具体边界问题]
```

---

## Phase Gate 3: 术语一致性 Check

1. Build terminology map from PRD glossary
2. Scan all specification documents
3. Flag any term variation

**Output Format**:
```markdown
## 术语一致性检查结果

| 标准术语 | PRD定义 | spec中使用 | module中使用 | 状态 |
|---------|---------|-----------|-------------|------|
| 溯源码 | trace_code | trace_code ✅ | traceId ❌ | ⚠️ 不一致 |

**结论**: [PASS/WARNING] — [具体不一致项]
```

---

## Phase Gate 4: 验收标准对齐 Check

1. Extract all acceptance criteria from PRD
2. Map each to corresponding `<module>.md` acceptance criteria
3. Flag any acceptance criterion without module coverage

**Output Format**:
```markdown
## 验收标准对齐检查结果

| PRD验收标准 | 覆盖模块 | 测试文件位置 | 状态 |
|-------------|----------|-------------|------|
| 溯源码生成-幂等性 | trace.md | integration-tests/modules/trace.test.ts | ✅ |
| 订单创建-并发 | [缺失] | - | ❌ 未覆盖 |

**结论**: [PASS/FAIL] — [具体缺失覆盖]
```

---

## Phase Gate 5: Issue Report Generation

If any CHECK found issues, generate structured issue report:

```markdown
# 审查报告 — [轮次N]

**审查时间**: [timestamp]
**审查文件**:
- PRD: [path]
- Spec: [path]
- Modules: [paths]

## 发现的问题

### 问题 1: [标题]
**类型**: [需求覆盖/模块边界/术语一致性/验收标准]
**严重级别**: ERROR / WARNING
**描述**: [具体问题描述]
**建议修正**:
- [修正方案]
**验证方法**: [如何确认已修正]
```

---

## Loop Mechanism

```
┌─ 循环开始 ──────────────────────────────────────┐
│                                                  │
│  1. 执行 Phase Gate 1-5                          │
│     → 生成检查结果                                │
│                                                  │
│  2. IF 发现问题：                                 │
│     → 生成审查报告                                │
│     → 输出：待修正项清单                          │
│     → DO NOT proceed to output lock              │
│                                                  │
│  3. IF 无问题：                                   │
│     → 输出：所有产出物已锁定 ✅                   │
│     → EXIT loop                                  │
│                                                  │
│  4. 等待修正（循环继续）                          │
│     → 重新执行 Phase Gate 1-5                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Loop until**: All four dimensions report PASS

---

# Output States

## State 1: BLOCKED
```
## 状态: BLOCKED

无法开始审查。原因：[缺失文件/文件被锁定/路径无效]

**需要**:
- 提供缺失文件的路径
- 或确认文件已准备好
```

## State 2: ISSUES_FOUND
```
## 状态: ISSUES_FOUND

发现 [N] 个问题需要修正。

**下一步**:
1. [角色①/②] 读取审查报告
2. [角色①/②] 修正对应产出物
3. 重新提交审查

**审查报告**: 见上方 Issue Report Generation
```

## State 3: LOCKED
```
## 状态: LOCKED ✅

所有审查维度通过：
- ✅ 需求覆盖完整性
- ✅ 模块边界合理性  
- ✅ 术语一致性
- ✅ 验收标准对齐

**产出物已锁定**：
- [文件列表]
- 后续 Agent 以此为唯一基准
```

---

# Constraints

**MUST DO:**
- Use PRD as single source of truth for functional requirements
- Check all four dimensions in every round
- Report specific issues, not vague suggestions
- Include verification method for each fix

**MUST NOT DO:**
- Skip any of the four dimensions
- Pass a review with known issues
- Proceed to Lock state until all issues resolved
- Change the review criteria between loops

---

# Gotchas

- **PRD is the boss** — If ① and ② disagree on interpretation, PRD decides
- **Consistency over style** — Terminology check is about consistency, not about which term is "better"
- **边界仲裁** — If module boundary is unclear, default to the module that "owns" the related database table
- **锁后变更** — Once locked, any change requires going through the full review loop again
- **Human escalation** — If loop exceeds 3 rounds without resolution, output unresolved list and recommend human decision
---
name: kf-mvp-test-review
description: >-
  Load when user asks to review test cases, verify test coverage, or audit
  integration test files. Triggers: 测试审查, test review, 测试用例检查,
  测试覆盖验证, 测试质量审查. Also load when Stage2 ③b-1/③b-2 are complete
  and test cases need static verification before Stage3.
metadata:
  pattern: reviewer
  domain: mvp-stage2-gate
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-test-single
      type: sequential
    - target: kf-mvp-test-e2e
      type: sequential
    - target: kf-mvp-biz-expert
      type: semantic
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# Test Case Static Reviewer — 测试用例静态审查技能

> **Core Belief**: Bad tests are worse than no tests. They create false confidence. Every test case must be verified against the contract and specs BEFORE execution.

**Division of Labor**: This Skill focuses on **static verification of test case correctness**. It checks that test files exist, reference valid API routes, cover all PRD scenarios, and use correct data types. Does NOT execute tests — that happens in Stage4. Follows Reviewer pattern.

**Stage2 最后一道防线**：仅检查"用例写对了没有"，不实际执行（执行在 Stage4）。

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.7 — ③c 测试用例静态审查:

1. **Static only** — Review test case structure and references, not runtime behavior
2. **ERROR blocks Stage3** — Any ERROR-level issue must be fixed before Stage3 starts
3. **WARNING is advisory** — Documented but does not block progress
4. **Lightweight and fast** — 15-30 minute review, not deep analysis

---

# Input Artifacts

**必须提供的文件**：

| 文件 | 提供者 | 说明 |
|------|--------|------|
| `integration-tests/modules/` | ③b-1 单模块测试专家 | 每个模块的API集成测试 |
| `integration-tests/scenarios/` | ③b-2 业务条线测试专家 | 跨模块场景测试 |
| `<module>.md` (all) | ② 业务领域专家 | 模块验收标准 |
| `PRD.md` | 产品经理 | 业务主流程参考 |
| `api-contract.yaml` | ① 架构专家 | API路由定义参考 |

**前置条件**: ③b-1和③b-2全部完成。

---

# Four Review Dimensions

## Dimension 1: 文件存在性与完整性 (File Existence)

**Question**: Does every module have a corresponding test file? Is it non-empty?

**Verification Method**:
1. Read `task.md` → extract all module names
2. Check `integration-tests/modules/<module>.test.ts` exists for each module
3. Verify file size > 0 (not empty placeholder)
4. Verify file is valid TypeScript (can at least be parsed)

**Severity**:
- ERROR: Missing test file for any module
- ERROR: Test file is empty or contains only comments
- WARNING: Test file < 10 lines (suspiciously thin)

---

## Dimension 2: API路由有效性 (API Route Validity)

**Question**: Does every `app.request()` or `fetch()` call in tests reference a valid API route defined in api-contract.yaml?

**Verification Method**:
1. Extract all API routes from `api-contract.yaml` (method + path)
2. Scan all test files for HTTP method calls (`app.request('GET', '/api/...')`, `fetch('/api/...')`, etc.)
3. Cross-reference each test route against api-contract.yaml
4. Flag routes that don't exist in the contract

**Severity**:
- ERROR: Test references an API route NOT defined in api-contract.yaml
- WARNING: Test uses route variant that differs from contract (e.g., `/products` vs `/product`)

---

## Dimension 3: 场景覆盖完整性 (Scenario Coverage)

**Question**: Do the scenario tests fully cover all steps in PRD's business main flows?

**Verification Method**:
1. Extract all business main flows from PRD "业务主流程" section
2. List each flow's sequential steps
3. Scan `integration-tests/scenarios/` for test files
4. Map each scenario test to corresponding PRD flow
5. Check if all steps in each flow are covered

**Severity**:
- ERROR: A PRD business main flow has NO corresponding scenario test file
- ERROR: A scenario test covers < 50% of the flow's steps
- WARNING: A step within a flow has no explicit test assertion

---

## Dimension 4: Fixture类型一致性 (Fixture Type Consistency)

**Question**: Do test data fixtures match the field types defined in schema.sql?

**Verification Method**:
1. Extract table schemas from `schema.sql` (column name + type + constraints)
2. Scan test files for fixture/seed data objects
3. Compare fixture field types against schema column types
4. Check for: type mismatches (e.g., string where INT expected), missing NOT NULL fields, invalid enum values

**Severity**:
- ERROR: Fixture uses wrong type for a schema column (e.g., string for INTEGER)
- ERROR: Fixture missing a NOT NULL field with no default
- WARNING: Fixture value violates CHECK constraint implied by schema context

---

# Review Workflow

## Phase Gate 0: Preparation

Before starting, confirm:
- [ ] `integration-tests/modules/` directory exists and contains files
- [ ] `integration-tests/scenarios/` directory exists and contains files
- [ ] `PRD.md` is accessible
- [ ] `api-contract.yaml` is accessible
- [ ] All `<module>.md` files are accessible

**IF any directory is empty**: Report BLOCKED, DO NOT proceed.

---

## Phase Gate 1: File Existence Check

1. Read `task.md` → list all modules
2. For each module, check `integration-tests/modules/<module>.test.ts`
3. Report missing or empty files

**Output Format**:
```markdown
## 文件存在性检查结果

| 模块 | 测试文件 | 状态 | 问题 |
|------|---------|------|------|
| user | integration-tests/modules/user.test.ts | ✅ | - |
| product | integration-tests/modules/product.test.ts | ❌ | 文件为空 |
| trace | - | ❌ | 文件不存在 |

**结论**: [PASS/FAIL] — [具体缺失项]
```

---

## Phase Gate 2: API Route Validity Check

1. Parse `api-contract.yaml` → build route registry
2. Scan all test files for API calls
3. Cross-reference each call against registry

**Output Format**:
```markdown
## API路由有效性检查结果

| 测试文件 | 引用路由 | api-contract中定义 | 状态 |
|---------|---------|-------------------|------|
| user.test.ts:45 | GET /api/users | ✅ | ✅ |
| product.test.ts:23 | POST /api/product | ❌ (应为 /api/products) | ❌ |

**结论**: [PASS/FAIL] — [具体路由问题]
```

---

## Phase Gate 3: Scenario Coverage Check

1. Extract business main flows from PRD
2. Map scenario test files to flows
3. Check step coverage within each flow

**Output Format**:
```markdown
## 场景覆盖完整性检查结果

| PRD主流程 | 场景测试文件 | 总步数 | 已覆盖 | 覆盖率 | 状态 |
|-----------|------------|--------|--------|--------|------|
| 溯源全流程 | marketing-to-trace.test.ts | 6 | 6 | 100% | ✅ |
| 订单退货流程 | order-return.test.ts | 4 | 3 | 75% | ⚠️ |

**结论**: [PASS/FAIL] — [具体覆盖缺失]
```

---

## Phase Gate 4: Fixture Type Consistency Check

1. Parse `schema.sql` → build type registry
2. Scan test fixtures for data objects
3. Compare field types

**Output Format**:
```markdown
## Fixture类型一致性检查结果

| 测试文件 | 表 | 字段 | Schema类型 | Fixture值 | 状态 |
|---------|-----|------|-----------|----------|------|
| user.test.ts:12 | users | role | TEXT | "admin" | ✅ |
| product.test.ts:8 | products | price | INTEGER | "free" | ❌ 类型不匹配 |

**结论**: [PASS/FAIL] — [具体类型问题]
```

---

## Phase Gate 5: Final Review Report

Generate structured review report:

```markdown
# 测试用例静态审查报告

**审查时间**: <timestamp>
**审查范围**:
- 测试模块数: [N]
- 场景测试数: [N]
- 引用API路由数: [N]

## 审查结果汇总

| 维度 | 状态 | ERROR数 | WARNING数 |
|------|------|---------|-----------|
| 文件存在性 | [PASS/FAIL] | [N] | [N] |
| API路由有效性 | [PASS/FAIL] | [N] | [N] |
| 场景覆盖完整性 | [PASS/FAIL] | [N] | [N] |
| Fixture类型一致性 | [PASS/FAIL] | [N] | [N] |

## ERROR 问题清单（必须修复）

### ERROR #1: [标题]
**维度**: [文件存在性/API路由/场景覆盖/Fixture类型]
**文件**: [路径:行号]
**描述**: [问题描述]
**影响**: [对Stage3的影响]
**修复建议**: [具体修复方案]

## WARNING 问题清单（建议修复）

### WARNING #1: [标题]
**维度**: [维度]
**文件**: [路径:行号]
**描述**: [问题描述]
**修复建议**: [具体修复方案]

## 审查结论

| 结果 | 说明 |
|------|------|
| ✅ PASS | 无ERROR，可进入Stage3 |
| ❌ FAIL | 存在ERROR，必须修复后重新审查 |

**下一步**:
- [ ] ③b-1/③b-2对应Agent修复ERROR
- [ ] 重新提交静态审查
- [ ] 全部通过后进入Stage3
```

---

# Review Standards

## 通过标准

- **PASS**: 无 ERROR 级别问题。WARNING 可记录但通过。
- **FAIL**: 存在任何 ERROR 级别问题。

## 修复流程

```
审查报告产出
    ↓
ERROR问题 → 分发到③b-1或③b-2对应Agent
    ↓
Agent修复测试用例
    ↓
重新提交静态审查
    ↓
全部通过 → 进入Stage3
```

---

# Constraints

**MUST DO:**
- Check all four dimensions
- Report specific file:line locations for each issue
- Distinguish ERROR (blocks Stage3) from WARNING (advisory)
- Include fix suggestions for each issue

**MUST NOT DO:**
- Execute or run any tests (this is static review only)
- Skip any of the four dimensions
- Pass a review with known ERROR issues
- Modify test files directly (review only, fixes by ③b-1/③b-2)

---

# Gotchas

- **Static, not runtime** — We check test STRUCTURE, not test RESULTS. Execution happens in Stage4.
- **Contract is the authority** — If a test references a route not in api-contract.yaml, it's an ERROR regardless of intent.
- **Empty files are errors** — A file that exists but has no test cases provides false confidence.
- **Type mismatches matter** — An INTEGER field seeded with a string value will cause runtime failures that are hard to debug.
- **Scenario coverage is holistic** — Missing one step in a 6-step flow means the entire flow is at risk, not just one step.
- **PRD is the baseline** — Coverage is measured against PRD business flows, not against `<module>.md` acceptance criteria (those are already verified in ↺ cycle).

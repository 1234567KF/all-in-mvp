---
name: kf-mvp-code-review
description: >-
  Load when user asks to review code, check code quality, verify implementation,
  or audit module against contract. Triggers: 代码审查, review, 检查代码,
  code review, 审查实现, 验证契约, 合规检查. Also load when backend
  TDD agent triggers review.
metadata:
  pattern: reviewer
  domain: mvp-stage3
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
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


# MVP Code Reviewer — 代码审查技能

> **Core Belief**: Code review is not nitpicking. It's the last line of defense before defects reach production. Every review must verify: contract compliance, schema consistency, exception coverage.

**Division of Labor**: This Skill focuses on **verification against specifications**. It checks implementation against api-contract.yaml, schema.sql, and module specs. Follows Reviewer pattern with modular scoring criteria.

---

# Core Philosophy

Derived from MVP Whitepaper Section 3.1 — Code Review:

1. **Contract is law** — Implementation must match api-contract.yaml
2. **Schema consistency** — All database operations must use global schema
3. **Exception coverage** — Every interface must handle error cases
4. **Four severity levels** — ERROR / WARNING / INFO / PASS

---

# Four Review Dimensions

## Dimension 1: 接口契约一致性 (API Contract Compliance)

**Question**: Does implementation match api-contract.yaml exactly?

**Checkpoints**:
- Route paths match
- HTTP methods match
- Request DTO fields match (types, required/optional)
- Response DTO structure matches
- Error codes match
- Authentication requirements match

**Severity**:
- ERROR: Route/DTO mismatch
- WARNING: Field type conversion differences
- INFO: Documentation differences

---

## Dimension 2: Schema定义一致性 (Schema Consistency)

**Question**: Do database operations use global schema correctly?

**Checkpoints**:
- All tables referenced exist in schema.sql
- All columns referenced exist in table definition
- Foreign key relationships are respected
- Soft delete conventions applied (`WHERE deleted_at IS NULL`)
- Audit fields (created_at, updated_at) populated

**Severity**:
- ERROR: Missing table/column
- WARNING: Incorrect constraint usage
- INFO: Missing index suggestion

---

## Dimension 3: 异常路径覆盖 (Exception Coverage)

**Question**: Are all error cases properly handled?

**Checkpoints**:
- Invalid input returns 400
- Unauthenticated returns 401
- Unauthorized returns 403
- Not found returns 404
- Conflict returns 409
- Server error returns 500 (never expose internal errors)

**Test Coverage**:
- Each error case has corresponding test
- Tests verify status code AND error response format

**Severity**:
- ERROR: Exception not handled
- WARNING: Error message too detailed (exposes internals)
- INFO: Suggestion for better error messaging

---

## Dimension 4: 代码风格与最佳实践 (Code Quality)

**Question**: Is code following project conventions?

**Checkpoints**:
- Naming conventions (snake_case in DB, camelCase in TS)
- No hardcoded values (use constants/env vars)
- No SQL injection vulnerabilities (use parameterized queries)
- No sensitive data in logs
- Functions are small and focused
- Comments explain "why" not "what"

**Severity**:
- WARNING: Style deviation
- INFO: Suggestions for improvement

---

## TDD 循环中的 Review 触发条件（白皮书 Section 6.3）

| 场景 | 是否触发 Review | 说明 |
|------|----------------|------|
| 新功能 Red 阶段 | 否 | 测试失败是预期行为 |
| Green 阶段测试仍失败 | **是** | 实现逻辑有问题，立即 Review |
| Refactor 后测试失败 | **是** | 重构破坏了行为，Review + 回滚或修复 |
| 新增异常路径测试 | 否 | 正常 TDD 流程 |
| 模块间接口调用 | **是** | 需验证契约一致性，Review 接口 DTO |
| 新增代码未覆盖异常路径 | **是** | 补充测试，Review 缺失覆盖点 |

---

# Review Workflow

## Phase Gate 0: Prepare Inputs

**Confirm available**:
- [ ] Implementation files: `src/modules/<module>/`
- [ ] Contract file: `api-contract.yaml`
- [ ] Schema file: `schema.sql`
- [ ] Module spec: `<module>.md`
- [ ] Integration tests: `integration-tests/modules/<module>.test.ts`

---

## Phase Gate 1: API Contract Compliance Check

**For each endpoint in api-contract.yaml**:

1. Read route definition
2. Read implementation
3. Compare path, method, DTOs

**Output**:
```markdown
## 接口契约一致性检查

| 契约路径 | 实现路径 | 方法 | DTO | 状态 |
|---------|---------|------|-----|------|
| POST /api/user | ✅ 存在 | ✅ | ✅ | ✅ |
| GET /api/user/:id | ✅ 存在 | ✅ | ✅ | ✅ |
| PUT /api/user/:id | ❌ 缺失 | - | - | ❌ |

**问题清单**:
- [ ] ERROR: PUT /api/user/:id 未实现
- [ ] WARNING: CreateUserDto缺少 email 字段校验
```

---

## Phase Gate 2: Schema Consistency Check

**For each database operation**:

1. Read schema definition
2. Read implementation SQL/queries
3. Verify field names, types, constraints

**Output**:
```markdown
## Schema定义一致性检查

| 表名 | 操作 | 字段 | Schema | 状态 |
|------|------|------|--------|------|
| users | INSERT | email | TEXT NOT NULL | ✅ |
| users | INSERT | role | TEXT DEFAULT 'user' | ✅ |
| users | SELECT | * | WHERE deleted_at | ⚠️ 缺少WHERE |

**问题清单**:
- [ ] WARNING: users SELECT缺少软删除条件
- [ ] ERROR: products INSERT缺少必填字段 category_id
```

---

## Phase Gate 3: Exception Coverage Check

**For each endpoint**:

1. List possible error cases
2. Check if error handling exists
3. Verify test coverage

**Output**:
```markdown
## 异常路径覆盖检查

| 端点 | 异常类型 | 处理状态 | 测试覆盖 |
|------|----------|----------|----------|
| POST /api/user | 邮箱已存在 | ✅ 409 | ✅ |
| POST /api/user | 参数缺失 | ✅ 400 | ✅ |
| GET /api/user/:id | 用户不存在 | ✅ 404 | ⚠️ 缺失 |
| POST /api/user | 未认证 | ✅ 401 | ⚠️ 缺失 |

**问题清单**:
- [ ] WARNING: GET /api/user/:id "用户不存在" 未覆盖测试
```

---

## Phase Gate 4: Code Quality Check

**Automated checks**:
- [ ] Naming conventions
- [ ] No hardcoded values
- [ ] No SQL injection
- [ ] Function size

**Output**:
```markdown
## 代码质量检查

| 检查项 | 文件 | 状态 | 详情 |
|--------|------|------|------|
| 命名 | service.ts:45 | ⚠️ | userId应为user_id |
| 硬编码 | routes.ts:23 | ❌ | 使用硬编码"admin"，应使用常量 |
| SQL注入 | service.ts:67 | ✅ | 使用参数化查询 |
| 函数大小 | service.ts:120 | ❌ | 函数超100行，建议拆分 |

**问题清单**:
- [ ] ERROR: routes.ts硬编码角色名
- [ ] WARNING: service.ts函数过大
```

---

## Phase Gate 5: Review Report

**Generate structured report**:

```markdown
# 代码审查报告

**模块**: [module]
**审查时间**: [timestamp]
**审查者**: kf-mvp-code-review

## 审查结果汇总

| 维度 | 通过率 | 问题数 |
|------|--------|--------|
| 接口契约一致性 | 95% | 1 ERROR |
| Schema一致性 | 90% | 1 WARNING |
| 异常路径覆盖 | 80% | 2 WARNING |
| 代码质量 | 75% | 2 ERROR |

## 问题详情

### ERROR #1: PUT /api/user/:id 未实现
**文件**: src/modules/user/routes.ts
**位置**: 第N行
**问题**: 契约定义了更新接口但未实现
**建议**: 实现更新逻辑或与业务确认是否需要

### WARNING #1: 软删除条件缺失
**文件**: src/modules/user/service.ts
**位置**: 第M行
**问题**: SELECT查询未包含WHERE deleted_at IS NULL
**建议**: 添加软删除条件

## 修复建议

1. 实现PUT /api/user/:id接口
2. 在所有SELECT查询中添加软删除条件
3. 补充异常路径测试

## 审查结论

| 结果 | 说明 |
|------|------|
| ✅ PASS | 无ERROR，所有WARNING已确认可接受 |
| ⚠️ CONDITIONAL PASS | 有WARNING，需确认业务可接受 |
| ❌ FAIL | 有ERROR，必须修复 |

**建议**:
- [ ] 修复ERROR后重新审查
- [ ] 确认WARNING的业务影响
```

---

# Review 流转协议

> CR 通过后 TDD Agent 方可写入 DONE 标记。打回后须重新走完整流程。

```
TDD Agent 完成开发 → 提交 CR
  ↓
CR Agent 审查
  ├── PASS → TDD Agent 写入 DONE 标记 → Coordinator 释放依赖模块
  └── FAIL → TDD Agent 修复
       ↓
       删除 DONE 标记（如存在）
       ↓
       TDD 重新验证（确保修复不引入新问题）
       ↓
       重新提交 CR 复评
       ↓
       打回上限 3 轮 → 超过 → BLOCKED → 人类介入
```

**DONE 标记写入前置条件**（全部满足才可写入）：
1. ✅ 所有模块测试通过
2. ✅ CR 终审 PASS
3. ✅ 无已知 P0/P1 Bug

---

# Review States

## State 1: PASS

```
## 审查结论: ✅ PASS

所有维度检查通过：
- ✅ 接口契约一致性
- ✅ Schema一致性
- ✅ 异常路径覆盖
- ✅ 代码质量

**可进入下一阶段**
```

## State 2: CONDITIONAL PASS

```
## 审查结论: ⚠️ CONDITIONAL PASS

存在WARNING，需确认：
- [ ] WARNING #1: [描述] - 业务确认可接受？
- [ ] WARNING #2: [描述] - 业务确认可接受？

**需要业务确认后方可进入下一阶段**
```

## State 3: FAIL

```
## 审查结论: ❌ FAIL

存在ERROR，必须修复：
- [ ] ERROR #1: [描述]
- [ ] ERROR #2: [描述]

**修复后重新提交审查**
```

---

# Constraints

**MUST DO:**
- Check all four dimensions
- Report specific issues with file:line locations
- Include fix suggestions for each issue
- Return structured review report

**MUST NOT DO:**
- Pass known issues
- Suggest style changes without evidence they cause bugs
- Change code without consent (review only)
- Skip any dimension

---

# Gotchas

- **Contract is source of truth** — If contract says 400, implementation must return 400, not 422
- **Soft delete is automatic** — Unless specified, all SELECT must include `WHERE deleted_at IS NULL`
- **Error message sanitization** — Never expose internal details (stack traces, SQL) in error responses
- **Test coverage matters** — Implementation without tests is half-reviewed at best
- **Review ≠ rewrite** — Suggest fixes, don't rewrite code unless explicitly asked
- **终审（DONE 前强制触发）** — TDD Agent 所有测试通过后、写 DONE 标记前，必须触发 CR 终审
- **流转协议** — Review → fix → 删除 DONE 标记 → TDD 重新验证 → 再写 DONE → 提交复评
- **打回上限** — 同一模块 CR 打回最多 3 轮，超过 → 标记 BLOCKED → 人类介入
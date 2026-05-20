---
name: kf-mvp-integration
description: >-
  Load when user asks to integrate frontend and backend, run integration tests,
  or verify system end-to-end. Triggers: 集成, 联调, 前后端集成, integration,
  前后端联调, 系统验证, 验收测试. Also load when Stage4 integration
  is needed.
metadata:
  pattern: pipeline
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-backend-tdd
      type: sequential
    - target: kf-mvp-frontend-dev
      type: sequential
    - target: kf-mvp-test-single
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Integration Specialist — 集成验证技能

> **Core Belief**: Integration is where the real system meets the designed system. The goal: swap mock for real API with zero user-visible changes.

**Division of Labor**: This Skill focuses on **frontend-backend integration** and **system verification**. It outputs integration test reports and bug fixes. Follows Pipeline pattern with strict phase gates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 4 — 集成与验收:

1. **Mock to real swap** — Change API URL, nothing else should change
2. **Schema consistency** — Verify all API contracts are honored
3. **End-to-end verification** — Every PRD acceptance criterion must pass
4. **Bug fix loop** — Issues found → fixed → retested until clean

---

# Integration Workflow

```
┌─ Integration Workflow ──────────────────────────────────┐
│                                                          │
│  Phase 1: Backend Merge                                 │
│    → Merge all module routes to unified entry           │
│    → Verify global Schema consistency                  │
│    → Run all unit tests (must pass)                     │
│                                                          │
│  Phase 2: Frontend Integration                         │
│    → Swap mock API → real API URL                      │
│    → Verify all API calls work                        │
│    → Check response format compatibility              │
│                                                          │
│  Phase 3: Integration Tests                           │
│    → Run all integration tests                        │
│    → Execute E2E scenarios                            │
│    → Document failures                               │
│                                                          │
│  Phase 4: Bug Fix Loop                                │
│    → For each failure: investigate → fix → retest    │
│    → Loop until all tests pass                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

# Stage 1: Backend Merge

## Route Consolidation

```typescript
// src/index.ts (before)
import { Hono } from 'hono';
import { userRoutes } from './modules/user/routes';
import { productRoutes } from './modules/product/routes';

const app = new Hono();

// Each module as separate route
app.route('/api/users', userRoutes);
app.route('/api/products', productRoutes);

export default app;
```

## Schema Verification

**Check each module:**
- [ ] All tables defined in global schema
- [ ] No conflicting column definitions
- [ ] Foreign keys reference existing tables
- [ ] Indexes don't conflict

**Output**:
```markdown
## Schema一致性检查

| 模块 | 表 | 状态 | 问题 |
|------|-----|------|------|
| user | users | ✅ | - |
| product | products | ✅ | - |
| trace | trace_codes | ✅ | 缺少索引 |

**问题清单**:
- [ ] WARNING: trace_codes表缺少code索引
```

## Unit Test Verification

```bash
# Run all unit tests
npm test

# Expected: all tests pass
# If any fail → fix before proceeding
```

---

# Stage 2: Frontend Integration

## API URL Swap

**Development (.env)**:
```
VITE_API_BASE_URL=http://localhost:3001/api
```

**Production (.env)**:
```
VITE_API_BASE_URL=https://api.example.com/api
```

## Integration Verification Steps

1. **Start real backend**
   ```bash
   npm run dev:backend
   ```

2. **Verify frontend can reach backend**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Test each API call**
   - [ ] Login works
   - [ ] CRUD operations work
   - [ ] Error responses handled
   - [ ] Authentication persists

## Verification Template

```markdown
## API联调检查

| 模块 | API | 前端→后端 | 后端→前端 | 状态 |
|------|-----|----------|----------|------|
| auth | POST /auth/login | ✅ | ✅ | 通过 |
| user | GET /users | ✅ | ✅ | 通过 |
| product | POST /products | ✅ | ❌ | 400错误 |

**问题清单**:
- [ ] product创建返回400，字段类型不匹配
```

---

# Stage 3: Integration Tests

## Test Execution

```bash
# Run all integration tests
npm run test:integration

# Run E2E scenarios
npm run test:e2e

# Run full test suite
npm run test:all
```

## Test Report Template

```markdown
# 集成测试报告

**执行时间**: [timestamp]
**执行结果**: [PASS/FAIL]

## 测试结果汇总

| 测试类型 | 总数 | 通过 | 失败 | 通过率 |
|---------|------|------|------|--------|
| 单元测试 | [N] | [N] | [0] | 100% |
| 模块集成测试 | [N] | [N] | [N] | [X%] |
| 场景测试 | [N] | [N] | [N] | [X%] |

## 失败的测试

### [Test Name]
**类型**: [单元/集成/场景]
**模块**: [module]
**错误**:
```
[error output]
```
**原因分析**: [原因]
**修复方案**: [方案]
```

---

# Stage 4: Bug Fix Loop

## Bug Classification

| Severity | Definition | Action |
|----------|-------------|--------|
| BLOCKER | Core flow broken | Fix immediately |
| HIGH | Feature impaired | Fix same day |
| MEDIUM | Minor issue | Fix within week |
| LOW | Cosmetic | Fix in next sprint |

## Fix Workflow

```markdown
## Bug #[N] 修复

**标题**: [bug title]
**严重级别**: [BLOCKER/HIGH/MEDIUM/LOW]
**发现阶段**: [集成测试/E2E测试/手动验证]

### 根因分析
[analysis]

### 修复方案
[code changes]

### 回归测试
[new test or verification steps]

### 验证结果
[ ] 修复已验证
[ ] 回归测试通过
```

---

# Acceptance Criteria Verification

## PRD验收标准核对

| PRD标准 | 对应测试 | 执行结果 |
|---------|----------|----------|
| 用户可登录 | auth.test.ts | ✅ PASS |
| 可创建产品 | product.test.ts | ✅ PASS |
| 溯源码正确生成 | trace.test.ts | ❌ FAIL |

## Final Acceptance Check

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E scenarios pass
- [ ] All PRD acceptance criteria verified
- [ ] No known bugs with HIGH or BLOCKER severity
- [ ] Performance acceptable

---

# Integration Checklist

## Pre-Integration
- [ ] Backend fully implemented
- [ ] Frontend fully implemented
- [ ] Mock tests written and pass
- [ ] Schema locked

## During Integration
- [ ] API URL swapped
- [ ] Auth flow verified
- [ ] CRUD operations verified
- [ ] Error handling verified
- [ ] No console errors

## Post-Integration
- [ ] All tests pass
- [ ] All acceptance criteria met
- [ ] Performance acceptable
- [ ] Documentation updated

---

# Constraints

**MUST DO:**
- Run full test suite before declaring success
- Fix all BLOCKER and HIGH issues
- Verify all PRD acceptance criteria
- Document all test failures

**MUST NOT DO:**
- Skip integration tests
- Ignore failing tests
- Change contracts without review
- Skip regression testing

---

# Gotchas

- **CORS** — Backend must allow frontend origin
- **Auth token format** — Ensure Bearer token matches backend expectation
- **Response timing** — Real API may be slower than mock, handle loading states
- **Null handling** — Real backend may return null where mock returns empty
- **Date formats** — Backend may use different date format than mock
---
name: kf-mvp-debug
description: >-
  Load when user asks to debug, fix bugs, investigate errors, or do root cause
  analysis. Triggers: 调试, bug修复, 根因分析, debug, fix bug, 错误排查,
  investigate, 问题定位. Also load when integration tests fail.
metadata:
  pattern: pipeline + investigator
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-backend-tdd
      type: sequential
    - target: kf-mvp-code-review
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


# MVP Debug Specialist — Bug修复技能

> **Core Belief**: No fix without root cause. Guessing leads to bugs covering bugs. The Iron Law: investigate → analyze → hypothesize → implement → verify.

**Division of Labor**: This Skill focuses on **systematic debugging** with four phases. It outputs root cause analysis + fix + regression tests. Follows Pipeline pattern with mandatory gate checks.

---

# Core Philosophy

Derived from MVP Whitepaper Section 4.4 — Debug 修复:

1. **Root cause, not symptoms** — Fix the cause, not the symptom
2. **Hypothesis before action** — Form a hypothesis before touching code
3. **Regression is mandatory** — Every fix needs a regression test
4. **High-risk review** — Significant changes need code review

---

# Four-Phase Debug Process

```
┌─ Debug Process ──────────────────────────────────┐
│                                                  │
│  Phase 1: INVESTIGATE                           │
│    → Gather evidence: logs, errors, repro       │
│    → DO NOT conclude yet                        │
│                                                  │
│  Phase 2: ANALYZE                               │
│    → Identify patterns and anomalies           │
│    → Map symptoms to components                │
│    → DO NOT fix yet                            │
│                                                  │
│  Phase 3: HYPOTHESIZE                           │
│    → Form root cause hypothesis                │
│    → Identify what code change would fix it   │
│    → DO NOT implement yet                      │
│                                                  │
│  Phase 4: IMPLEMENT                             │
│    → Apply fix                                 │
│    → Add regression test                       │
│    → Verify fix with tests                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

# Phase Gate 1: Investigate

## Required Evidence

- [ ] **Error message** — Full error text including stack trace
- [ ] **Reproduction steps** — Exact steps to reproduce the bug
- [ ] **Environment** — OS, Node version, database state
- [ ] **Expected behavior** — What should happen
- [ ] **Actual behavior** — What actually happened

**IF evidence incomplete**: Ask user to provide missing information

## Investigation Output

```markdown
## Phase 1: Investigation

**Bug ID**: [auto-generated]
**Reported at**: [timestamp]
**Reporter**: [user]

### Evidence Collected

**Error Message**:
```
[full error text]
```

**Reproduction Steps**:
1. [step 1]
2. [step 2]
3. [step 3]

**Environment**:
- OS: [version]
- Node: [version]
- Database: [version]
- API: [version]

**Expected vs Actual**:
| Aspect | Expected | Actual |
|--------|----------|--------|
| [aspect 1] | [expected] | [actual] |
| [aspect 2] | [expected] | [actual] |

### Hypothesis: [pending - awaiting Phase 2]
```

---

# Phase Gate 2: Analyze

## Analysis Checklist

- [ ] **Which component** — Is this in frontend, backend, or database?
- [ ] **Which module** — Does it affect one module or multiple?
- [ ] **Timing** — Does it happen immediately or after some condition?
- [ ] **Pattern** — Does it happen every time or intermittently?
- [ ] **Scope** — Does it affect one user or all users?

## Analysis Techniques

### Log Analysis
```
Search for:
- ERROR level logs around the time of bug
- Exception stack traces
- Failed database operations
- Auth/permission failures
```

### Data Analysis
```
Check:
- Database state for affected records
- Cache state if applicable
- Session state for affected users
- Foreign key relationships
```

### Code Flow Analysis
```
Trace:
- Request path from entry to error
- Database queries executed
- External service calls made
- State changes along the way
```

## Analysis Output

```markdown
## Phase 2: Analysis

### Component Identification

| Component | Involvement | Evidence |
|-----------|--------------|----------|
| Frontend | [yes/no] | [evidence] |
| Backend | [yes/no] | [evidence] |
| Database | [yes/no] | [evidence] |

### Pattern Recognition

| Pattern | Evidence |
|---------|----------|
| Consistent? | [yes/no - always happens] |
| Timing | [immediate/delayed] |
| Scope | [single user/all users] |

### Affected Code Locations

| File | Line | Code | Issue |
|------|------|------|-------|
| [file] | [line] | [code] | [issue] |

### Next Step: Proceed to Phase 3 (Hypothesize)
```

---

# Phase Gate 3: Hypothesize

## Hypothesis Template

```markdown
## Phase 3: Root Cause Hypothesis

### Root Cause (Most Likely)

**Hypothesis**: [One sentence describing root cause]

**Supporting Evidence**:
- [evidence 1]
- [evidence 2]

**Contradicting Evidence**:
- [evidence that doesn't fit]

### Alternative Hypotheses

**Alternative 1**: [description]
- Supporting: [evidence]
- Contradicting: [evidence]

**Alternative 2**: [description]
- Supporting: [evidence]
- Contradicting: [evidence]

### Recommended Fix Approach

**Fix for Most Likely Hypothesis**:
1. [code change 1]
2. [code change 2]

**How to Verify**:
- [verification step 1]
- [verification step 2]
```

## Hypothesis Validation

Before proceeding to implement:

- [ ] Hypothesis explains ALL symptoms
- [ ] No contradictions remain
- [ ] Fix approach is clear
- [ ] If wrong, next most likely hypothesis is identified

---

# Phase Gate 4: Implement

## Implementation Checklist

- [ ] Backup original code (copy before changing)
- [ ] Apply minimal fix
- [ ] Add regression test
- [ ] Run affected tests
- [ ] Run full test suite
- [ ] Request code review if high-risk

## Fix Template

```typescript
// BUGFIX: [short description]
// Root cause: [explanation]
// Regression test: [test file and name]

// BEFORE:
// [old code]

// AFTER:
// [new code]

// VERIFICATION:
// Run [test] to verify fix
```

## Regression Test Template

```typescript
// integration-tests/regression/[bug-id].test.ts
describe(`Regression: [Bug Title]`, () => {
  it('should [expected behavior] after fix', async () => {
    // Arrange
    const setup = await setupBugScenario();
    
    // Act
    const result = await triggerBugScenario(setup);
    
    // Assert
    expect(result).toEqual(expectedBehavior);
  });
});
```

---

# Bug Report Template

When submitting for review:

```markdown
# Bug Report #[ID]

**Title**: [clear, concise title]
**Severity**: P0/P1/P2/P3
**Status**: FIXED

## Summary
[One paragraph summary]

## Root Cause
[Root cause explanation]

## Fix Applied
[Code changes made]

## Regression Test
[New test added to prevent recurrence]

## Verification
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Visual regression tests pass （V1+V2+V3，如为前端Bug）
[ ] Before/after screenshot comparison （如为 CAUSE:VISUAL_CSS）
[ ] Manual verification complete
```

---

# Severity Classification

| Severity | Definition | Response Time |
|----------|------------|---------------|
| P0 | System down, data loss | Immediate |
| P1 | Major feature broken | 4 hours |
| P2 | Feature impaired | 24 hours |
| P3 | Minor issue, workaround exists | 1 week |

---

# 根因分类（Root Cause Classification）

> 每个 Bug 修复后必须在 Bug Report 中标注根因类别，用于 Stage5 复盘分析。

| 根因类别 | 含义 | 示例 |
|---------|------|------|
| `CAUSE:PRD_AMBIGUITY` | PRD 定义模糊导致实现偏差 | "VIP用户"未定义，导致权限实现不同 |
| `CAUSE:PRD_CONFLICT` | PRD 内部存在矛盾 | 功能需求 A 和 B 的验收标准互斥 |
| `CAUSE:DESIGN_FLAW` | 架构/Schema 设计缺陷 | 外键关系错误、表结构不支持业务规则 |
| `CAUSE:DESIGN_MISSING` | 架构遗漏 | Schema 缺少必要字段、API 缺少必要端点 |
| `CAUSE:IMPL_ERROR` | 代码实现错误 | 空指针、逻辑错误、类型错误 |
| `CAUSE:IMPL_CONTRACT` | 实现与契约不一致 | 返回的字段名/状态码与 api-contract.yaml 不符 |
| `CAUSE:VISUAL_CSS` | CSS/样式视觉错误 | 颜色错误、布局错乱、元素遮挡、响应式断点失效 |
| `CAUSE:TEST_GAP` | 测试覆盖不足 | 已有测试通过但未覆盖该场景 |
| `CAUSE:ENV_MISMATCH` | 环境差异导致 | 开发环境正常但联调环境出错 |

**视觉类 Bug 特殊要求** — `CAUSE:VISUAL_CSS` 修复后必须产出 before/after 截图对比：

```yaml
# Bug Report 视觉附加字段
visual_evidence:
  before: "regression/screenshots/bug-004-before.png"
  after: "regression/screenshots/bug-004-after.png"
  diff: "regression/screenshots/bug-004-diff.png"
  description: "按钮颜色从灰色 #9CA3AF 修正为蓝色 #3B82F6"
```

```bash
# 产出示意流程
# 1. 截修复前截图
npx playwright screenshot --selector=".btn-primary" regression/screenshots/bug-004-before.png

# 2. 应用修复

# 3. 截修复后截图
npx playwright screenshot --selector=".btn-primary" regression/screenshots/bug-004-after.png

# 4. 产生对比
# diff.png 可手动或通过 image-magick 生成
```

**回归测试位置**：
```
regression/
├── bug-001-login-token-expiry.test.ts
├── bug-002-product-delete-foreign-key.test.ts
└── bug-003-trace-chain-integrity.test.ts
```

---

# 终止条件

| 终止类型 | 条件 | 后续动作 |
|---------|------|---------|
| **正常终止** | 所有 P0/P1 Bug 已修复并验证 | 更新 Bug Report，执行回归测试 |
| **时间终止** | 超过预设时间（4 小时） | 未修复的 Bug 进入后续迭代 |
| **回归终止** | 修复过程中引入新的 P0 级 Bug | 回退修复，重新评估方案 |
| **人工终止** | 人类明确决定停止修复 | 记录未解决问题，移入 Backlog |

---

# Constraints

**MUST DO:**
- Investigate before hypothesizing
- Hypothesize before implementing
- Add regression tests
- Verify fix with tests

**MUST NOT DO:**
- Guess and fix without evidence
- Change code without understanding root cause
- Skip regression tests
- Push without review for P0/P1

---

# Gotchas

- **Symptom vs Cause** — "API returns 500" is symptom; "missing null check" is cause
- **Soft delete side effects** — Bug might be "data not found" but cause is missing WHERE deleted_at
- **Race conditions** — Intermittent bugs are often race conditions, not code logic errors
- **Caching** — "Works now but broke after refresh" suggests cache invalidation issue
- **Foreign key order** — "Cannot delete" might be FK constraint, not soft delete
- **根因分类** — 修复后在 Bug Report 中标注根因类型：`CAUSE:PRD_AMBIGUITY` / `CAUSE:DESIGN_FLAW` / `CAUSE:IMPL_ERROR`
- **回归测试目录** — 修复后的回归测试放入 `regression/bug-<编号>-<简述>.test.ts`
- **视觉Bug截图** — CAUSE:VISUAL_CSS 修复后必须提供 before/after 截图，存入 `regression/screenshots/`
- **终止条件** — 正常终止（P0/P1 已修复）/ 时间终止（超 4h 入后续迭代）/ 回归终止（修复引入新 P0）/ 人工终止（人类决策停止）
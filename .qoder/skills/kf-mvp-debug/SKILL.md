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
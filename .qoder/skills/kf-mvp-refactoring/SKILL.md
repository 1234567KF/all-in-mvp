---
name: kf-mvp-refactoring
description: >-
  Load when user asks for refactoring guidance, code improvement, or technical
  debt reduction. Triggers: 重构, refactoring, 代码改进, technical debt,
  code quality, 代码优化, 清理代码. Also load when improving existing
  code structure.
metadata:
  pattern: tool-wrapper + reviewer
  domain: mvp-stage3
recommended_model: pro
graph:
  dependencies:
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


# MVP Refactoring — 代码重构技能

> **Core Belief**: Refactoring without tests is changing blind. The goal is to make changes safer, not to make code "better" by subjective standards. If it's not broken, don't fix it.

**Division of Labor**: This Skill focuses on **code refactoring patterns** using Tool Wrapper and Reviewer patterns. Provides refactoring techniques and validation.

---

# Core Philosophy

1. **Test first** — Add tests before changing code
2. **Small steps** — Change one thing at a time
3. **Verify constantly** — Run tests after each change
4. **Document reasons** — Why this refactoring is needed

---

# Refactoring Checklist

## Before Refactoring
- [ ] Tests exist and pass
- [ ] Code under refactoring is isolated
- [ ] Dependencies are clear
- [ ] Refactoring goal is defined

## During Refactoring
- [ ] Making incremental changes
- [ ] Tests still pass
- [ ] No behavior change (except intentional)
- [ ] Changes are committed regularly

## After Refactoring
- [ ] All tests pass
- [ ] Code review passed
- [ ] Performance acceptable
- [ ] Documentation updated

---

# Common Refactorings

## 1. Extract Function

```typescript
// BEFORE
function processOrder(order: Order) {
  const total = order.items.reduce((sum, item) => sum + item.price, 0);
  if (total > 1000) {
    total *= 0.9; // 10% discount
  }
  // ... more processing
}

// AFTER
function calculateTotal(items: OrderItem[], discountThreshold: number) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  if (subtotal > discountThreshold) {
    return subtotal * 0.9;
  }
  return subtotal;
}

function processOrder(order: Order) {
  const total = calculateTotal(order.items, 1000);
  // ... rest of processing
}
```

## 2. Replace Magic Numbers

```typescript
// BEFORE
if (user.age > 18) { ... }

// AFTER
const LEGAL_AGE = 18;
if (user.age > LEGAL_AGE) { ... }
```

## 3. Extract to Module

```typescript
// BEFORE - large service file
// src/services/userService.ts (500 lines)

// AFTER - module structure
// src/modules/users/
//   routes.ts     - Route definitions
//   service.ts    - Business logic  
//   types.ts      - Type definitions
//   validators.ts - Validation rules
//   constants.ts  - Constants
```

## 4. Replace Callback with Async/Await

```typescript
// BEFORE
function getUser(id, callback) {
  db.findById(id, (err, user) => {
    if (err) callback(err);
    callback(null, user);
  });
}

// AFTER
async function getUser(id) {
  const user = await db.findById(id);
  return user;
}
```

---

# Code Smells and Fixes

| Smell | Symptom | Fix |
|-------|--------|-----|
| Long Method | > 50 lines | Extract smaller functions |
| Large Class | > 300 lines | Split by responsibility |
| Long Parameter List | > 4 params | Use configuration object |
| Duplicate Code | Copy-paste | Extract to function |
| Dead Code | Unused code | Delete |
| Magic Numbers | Hardcoded values | Named constants |

---

# Refactoring Steps

## Step 1: Identify Target
```markdown
Refactoring: Extract user validation to separate module

Target: src/modules/users/service.ts (line 45-89)
Reason: Validation logic is mixed with business logic
```

## Step 2: Add Tests
```typescript
// Add tests for current behavior
describe('UserValidation', () => {
  it('should reject email without @', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

## Step 3: Make Small Changes
```typescript
// Extract one function at a time
export function validateEmail(email: string): boolean {
  return email.includes('@');
}
```

## Step 4: Verify Tests Pass
```bash
npm run test  # Must pass after each small change
```

## Step 5: Commit
```bash
git commit -m "refactor: extract email validation to helper"
```

---

# Technical Debt Tracking

```markdown
# Technical Debt Registry

| ID | Issue | Location | Effort | Impact | Status |
|----|-------|----------|--------|--------|--------|
| TD-001 | No error handling | service.ts:45 | 2h | Medium | Open |
| TD-002 | Duplicate validation | multiple | 4h | High | Open |
| TD-003 | Hardcoded values | config.ts | 1h | Low | Closed |

## Priority Guidelines
- **High**: Security or data integrity risk
- **Medium**: Frequent bug source or maintenance burden
- **Low**: Style/preference issues
```

---

# Boy Scout Rule

> Leave the code cleaner than you found it.

Apply when:
- Adding new feature nearby
- Fixing bug nearby
- Code review of nearby code
- Any code touch

Do:
- Rename confusing variable
- Extract long method
- Add missing error handling
- Replace magic number with constant

Don't:
- Large-scale restructuring without tests
- Changing behavior disguised as refactoring
- Removing "dead" code without verification

---

# Constraints

**MUST DO:**
- Test before refactoring
- Make small, incremental changes
- Verify tests after each change
- Commit after each step

**MUST NOT DO:**
- Refactor untested code
- Change behavior and structure simultaneously
- Skip code review
- Leave code worse than before

---

# Gotchas

- **Boy scout rule** — Always leave code cleaner than found
- **YAGNI** — You aren't gonna need it
- **Premature abstraction** — Don't abstract until pattern is clear
- **Naming** — Good names are the best documentation
- **Simplicity** — Simple is better than clever
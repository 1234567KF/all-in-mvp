---
name: kf-mvp-testing-strategy
description: >-
  Load when user asks for testing strategy, test planning, or testing approach
  for MVP projects. Triggers: 测试策略, 测试计划, testing strategy, test plan,
  质量保证, QA, test pyramid, 测试分层. NOT for: production load testing,
  security penetration testing, or compliance audit testing.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: all-in-mvp
      type: semantic
---

# MVP Testing Strategy — 测试策略技能

> **Core Belief**: Testing is not about coverage percentage. It's about confidence. A well-tested system can be changed without fear. The pyramid structure optimizes for that confidence.

**Division of Labor**: This Skill focuses on **testing strategy design** using Tool Wrapper pattern. Provides test pyramid, allocation, and execution plans.

**Default Tech Stack Context**:
- Unit/Integration: Vitest (NOT Jest)
- E2E: Playwright
- Backend integration: Hono `app.request()` adapter
- Database: SQLite in-memory per test

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Test pyramid** — More unit tests, fewer integration tests
2. **Confidence over coverage** — 80% coverage with real tests > 100% with shallow tests
3. **Fast feedback** — Run fast tests first
4. **Continuous testing** — Tests run on every commit

---

# Test Pyramid

```
           ┌─────────────┐
           │   E2E Tests │     10%
          ┌─────────────┐
         ┌───────────────┐
         │ Integration   │   30%
        ┌───────────────┘
       ┌─────────────────┐
       │  Unit Tests     │   60%
      ┌─────────────────┘
```

## Layer Details

| Layer | Scope | Speed | Count |
|-------|-------|-------|-------|
| Unit | Single function/method | < 1ms | Many |
| Integration | Module APIs | < 100ms | Medium |
| E2E | Full user flows | < 1s | Few |

---

# Test Allocation

## MVP Target

| Type | Count | Coverage | Purpose |
|------|-------|----------|---------|
| Unit Tests | 60% | 80%+ | Logic verification |
| Integration Tests | 30% | API endpoints | Contract verification |
| E2E Tests | 10% | Critical paths | User flow verification |

## What to Test at Each Layer

### Unit Tests
- Business logic
- Data transformations
- Validation rules
- Edge cases
- Error handling

### Integration Tests
- API endpoints
- Database operations
- External services (mocked)
- Authentication flows

### E2E Tests
- User signup flow
- Core business journey
- Critical paths (payment, etc.)

---

# Test Execution Strategy

## Fast Path (CI)
```bash
# Unit tests only (run in < 1 min)
npm run test:unit
```

## Full Path (PR)
```bash
# Unit + Integration (run in < 5 min)
npm run test:ci
```

## Nightly
```bash
# Full including E2E (run in < 30 min)
npm run test:e2e
```

---

# Test Naming Conventions

## Unit Test Naming

```typescript
// Pattern: [Unit] should [behavior] when [condition]
describe('UserValidator', () => {
  it('should return valid when email is correct format', () => {
    // ...
  });
  
  it('should return invalid when email is malformed', () => {
    // ...
  });
  
  it('should trim whitespace from email before validation', () => {
    // ...
  });
});
```

## Integration Test Naming

```typescript
// Pattern: [Method] [path] should [response] when [condition]
describe('POST /api/users', () => {
  it('should return 201 when creating valid user', async () => {
    // ...
  });
  
  it('should return 400 when email is invalid', async () => {
    // ...
  });
});
```

## E2E Test Naming

```typescript
// Pattern: [Actor] can [action] through [flow]
describe('Brand Owner', () => {
  it('can create marketing activity and generate trace codes', () => {
    // ...
  });
});
```

---

# Mock Strategy

## What to Mock

| Type | Mock? | Reason |
|------|-------|--------|
| Database | ✅ | Faster, isolated |
| External APIs | ✅ | Stability, rate limits |
| File system | ✅ | Clean state |
| Time | ✅ | Deterministic |
| Random | ✅ | Deterministic |

## What NOT to Mock

| Type | Why | Alternative |
|------|-----|-------------|
| Business logic | Test the real thing | Unit test with real code |
| Your own modules | Test integration | Integration test |
| Core utilities | Low maintenance | Real implementation |

---

# Test Data Strategy

## Fixtures
```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    id: 1,
    email: 'admin@example.com',
    role: 'admin',
  },
  user: {
    id: 2,
    email: 'user@example.com',
    role: 'user',
  },
};
```

## Factories
```typescript
// tests/factories/userFactory.ts
export const createUser = (overrides = {}) => ({
  id: faker.number.int(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: 'user',
  ...overrides,
});
```

---

# Coverage Targets

| Layer | Statements | Branches | Functions |
|-------|------------|----------|-----------|
| Unit | 90% | 85% | 90% |
| Integration | 70% | 65% | 70% |
| E2E | 50% | 50% | 50% |

---

# Testing Checklist

## Pre-PR
- [ ] Unit tests pass
- [ ] Coverage meets target
- [ ] No skipped tests (except temporarily)
- [ ] Integration tests cover new endpoints

## Pre-Merge
- [ ] E2E tests pass
- [ ] No new flaky tests
- [ ] Performance acceptable

---

# Constraints

**MUST DO:**
- Follow test pyramid
- Test critical paths first
- Mock external dependencies
- Keep tests fast

**MUST NOT DO:**
- Skip error path tests
- Test implementation details
- Leave tests commented out
- Create flaky tests

---

# Gotchas

- **Isolation** — Each test must be independent
- **Determinism** — No random failures
- **Speed** — Unit tests should be < 1ms each
- **Maintenance** — Tests that break often need redesign
- **Coverage** — 100% coverage with bad tests = 0 confidence
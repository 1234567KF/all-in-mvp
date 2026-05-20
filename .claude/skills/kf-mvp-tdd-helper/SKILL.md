---
name: kf-mvp-tdd-helper
description: >-
  Load when user asks for TDD guidance, test patterns, or testing best practices.
  Triggers: TDD, 测试驱动, 测试模式, test patterns, vitest, jest,
  testing best practices, 单元测试模式, test first. Also load when
  writing tests and unsure about patterns.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-backend-tdd
      type: semantic
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Testing: Vitest (unit/integration) + Playwright (E2E)
- Backend test: Hono app.request() adapter + SQLite in-memory

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP TDD Helper — TDD辅助技能

> **Core Belief**: TDD is not about testing, it's about design. Tests are the first consumer of your code. If it's hard to test, your design needs work.

**Division of Labor**: This Skill focuses on **TDD patterns and testing best practices** using Tool Wrapper pattern. Provides templates, patterns, and anti-patterns.

---

# Core Philosophy

1. **Red first** — Write the smallest possible failing test
2. **Minimal implementation** — Just enough to pass the test
3. **Refactor for clarity** — Clean up while keeping tests green
4. **Test behavior, not implementation** — Tests should survive refactoring

---

# Test File Structure

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

describe('[Unit Under Test]', () => {
  // Setup
  let sut: SystemUnderTest;
  
  beforeAll(() => {
    // Setup once before all tests
  });
  
  beforeEach(() => {
    // Reset state before each test
    sut = new SystemUnderTest();
  });
  
  // Tests
  describe('[Feature] Happy Path', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = sut.process(input);
      
      // Assert
      expect(result).toBe('processed: test');
    });
  });
  
  describe('[Feature] Exception Path', () => {
    it('should throw [error] when [condition]', () => {
      // Arrange
      const input = null;
      
      // Act & Assert
      expect(() => sut.process(input)).toThrow('Input required');
    });
  });
});
```

---

# Testing Patterns

## Pattern 1: Arrange-Act-Assert (AAA)

```typescript
it('should return user when valid id', () => {
  // Arrange
  const userId = 1;
  
  // Act
  const user = userService.findById(userId);
  
  // Assert
  expect(user).toEqual({ id: 1, name: 'Test User' });
});
```

## Pattern 2: Given-When-Then (GWT)

```typescript
describe('User Registration', () => {
  it('should create account when email is unique', () => {
    // Given
    const request = { email: 'new@example.com', password: 'pass123' };
    
    // When
    const result = authService.register(request);
    
    // Then
    expect(result.success).toBe(true);
    expect(result.user.email).toBe('new@example.com');
  });
});
```

## Pattern 3: Factory for Test Data

```typescript
const userFactory = {
  build: (overrides = {}) => ({
    id: faker.number.int(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    ...overrides,
  }),
  
  buildList: (count = 3) => 
    Array.from({ length: count }, () => userFactory.build()),
};
```

---

# API Test Patterns

## Pattern 1: Request-Response Test

```typescript
it('should return 201 when creating user', async () => {
  const res = await app.request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
    }),
  });
  
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.success).toBe(true);
  expect(data.data.email).toBe('test@example.com');
});
```

## Pattern 2: Error Response Test

```typescript
it('should return 400 when email is invalid', async () => {
  const res = await app.request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'invalid-email',
      password: 'password123',
    }),
  });
  
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.success).toBe(false);
  expect(data.error.code).toBe('VALIDATION_ERROR');
});
```

## Pattern 3: Auth Test

```typescript
it('should return 401 when not authenticated', async () => {
  const res = await app.request('/api/users');
  expect(res.status).toBe(401);
});

it('should return data when authenticated', async () => {
  const token = await getTestToken();
  const res = await app.request('/api/users', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
});
```

---

# Mock Patterns

## Pattern 1: Module Mock

```typescript
import { jest } from 'vitest';
import * as userRepo from '@/repos/userRepo';

jest.mock('@/repos/userRepo');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should call repository findById', async () => {
    // Arrange
    const mockFindById = userRepo.findById as jest.Mock;
    mockFindById.mockResolvedValue({ id: 1, name: 'Test' });
    
    // Act
    const result = await userService.findById(1);
    
    // Assert
    expect(mockFindById).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1, name: 'Test' });
  });
});
```

## Pattern 2: Database Mock

```typescript
import { sqliteMemory } from 'better-sqlite3-memory';

const db = sqliteMemory();

beforeEach(() => {
  db.exec('DELETE FROM users');
});
```

---

# Anti-Patterns

## Anti-Pattern 1: Testing Implementation

```typescript
// BAD - tests implementation details
it('should call validateEmail method', () => {
  expect(validator.validateEmail).toHaveBeenCalled();
});

// GOOD - tests behavior
it('should reject invalid email format', () => {
  expect(validateUser({ email: 'invalid' }).valid).toBe(false);
});
```

## Anti-Pattern 2: Brittle Tests

```typescript
// BAD - too specific
it('should return user with id 1 and name John', () => {
  expect(result).toEqual({ id: 1, name: 'John' });
});

// GOOD - checks what matters
it('should return user with matching email', () => {
  expect(result.email).toBe('john@example.com');
});
```

## Anti-Pattern 3: Shared State

```typescript
// BAD - tests share state
let userId: number;
it('should create user', () => { userId = createUser().id; });
it('should find user', () => { findUser(userId); }); // depends on prev test

// GOOD - each test is independent
it('should create user', () => {
  const user = createUser({ email: 'test@example.com' });
  expect(user.id).toBeDefined();
});

it('should find user by id', () => {
  const user = createUser({ email: 'test2@example.com' });
  const found = findUser(user.id);
  expect(found.email).toBe('test2@example.com');
});
```

---

# Test Coverage Rules

## Must Cover

- [ ] Happy path (main flow works)
- [ ] Error path (errors handled)
- [ ] Edge cases (0, 1, N, max)
- [ ] Null/undefined handling
- [ ] Auth & permission

## Coverage Thresholds

| Type | Minimum |
|------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

---

# Constraints

**MUST DO:**
- Follow AAA pattern
- Test behavior, not implementation
- Keep tests independent
- Use descriptive test names

**MUST NOT DO:**
- Test private methods
- Assert on exact timestamps
- Share state between tests
- Write implementation before test

---

# Gotchas

- **One assertion** — Multiple assertions in one test = harder to debug failure
- **Test isolation** — Each test must run independently, any order
- **Mock external dependencies** — API calls, DB, file system
- **Async testing** — Use async/await or .then(), never forget to await
- **Floating promises** — Always return or await async operations
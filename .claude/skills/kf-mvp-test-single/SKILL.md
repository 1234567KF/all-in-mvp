---
name: kf-mvp-test-single
description: >-
  Load when user asks to write unit tests, integration tests, or API tests for
  a single module. Triggers: 单元测试, 集成测试, API测试, 写测试,
  单模块测试, module test, integration test, 测试用例. Also load when
  module implementation is ready and needs test coverage.
metadata:
  pattern: generator + reviewer
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-biz-expert
      type: sequential
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Testing: Vitest (unit/integration) + Playwright (E2E)
- Backend test: Hono app.request() adapter + SQLite in-memory

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Single Module Test Writer — 单模块测试编写技能

> **Core Belief**: Tests are the living documentation of requirements. Every acceptance criterion must have a test that proves it works. Missing tests = missing requirements.

**Division of Labor**: This Skill focuses on **module-level API integration test generation**. It outputs test files in `integration-tests/modules/<module>.test.ts`. Follows Generator pattern with strict templates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.5 — ③b-1 单模块测试:

1. **One module at a time** — Tests are isolated per module
2. **Happy path + Exception path** — Cover both success and error cases
3. **Acceptance criteria driven** — Every criterion has a test
4. **Write only, do not execute** — Tests are prepared for Stage4 execution

---

# Output Location

```
integration-tests/
└── modules/
    └── <module>.test.ts   # Single module API tests
```

---

# Test File Structure

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { sqliteMemory } from '@conduit/backend';
import type { HonoType } from 'hono';

// Test fixtures
const testDb = sqliteMemory();
const testApp = new Hono();

// Setup
beforeAll(async () => {
  await initTestDb(testDb);
  setupTestRoutes(testApp);
});

afterAll(async () => {
  await closeTestDb(testDb);
});

describe('[Module] API Integration Tests', () => {
  describe('[Feature] Happy Path', () => {
    it('should [expected behavior] when [condition]', async () => {
      // Arrange
      const token = await getTestToken('admin');
      
      // Act
      const res = await testApp.request('/api/[module]', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ /* valid input */ })
      });
      
      // Assert
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({ /* expected fields */ });
    });
  });

  describe('[Feature] Exception Path', () => {
    it('should return [error] when [invalid condition]', async () => {
      // Arrange
      const token = await getTestToken('user');
      
      // Act
      const res = await testApp.request('/api/[module]', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ /* invalid input */ })
      });
      
      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

---

# Stage 1: Read Module Spec

**Read `<module>.md`**:
1. Extract acceptance criteria
2. List all interfaces
3. Note all error cases
4. Identify test data requirements

**Output**:
```markdown
## 测试需求分析

**模块**: [module]
**接口数量**: [N]
**验收标准数量**: [N]

**需要测试的接口**:
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/[module] | 列表 |
| GET | /api/[module]/:id | 详情 |
| POST | /api/[module] | 创建 |
| PUT | /api/[module]/:id | 更新 |
| DELETE | /api/[module]/:id | 删除 |

**异常场景**:
- [ ] 未认证 → 401
- [ ] 无权限 → 403
- [ ] 参数缺失 → 400
- [ ] 资源不存在 → 404
- [ ] 重复创建 → 409
```

---

# Stage 2: Happy Path Tests

## Test Template

```typescript
describe('[Feature] Happy Path', () => {
  it('should return list with pagination', async () => {
    // Arrange: create test data
    await seedTestData('products', [
      { name: 'Product A' },
      { name: 'Product B' }
    ]);
    const token = await getTestToken('admin');

    // Act
    const res = await testApp.request('/api/products?page=1&limit=10', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.list).toHaveLength(2);
    expect(data.data.total).toBe(2);
    expect(data.data.page).toBe(1);
  });

  it('should create resource with valid data', async () => {
    // Arrange
    const token = await getTestToken('admin');
    const validData = {
      name: 'New Product',
      categoryId: 1
    };

    // Act
    const res = await testApp.request('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(validData)
    });

    // Assert
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('New Product');
    expect(data.data.id).toBeDefined();
  });
});
```

---

# Stage 3: Exception Path Tests

## Test Template

```typescript
describe('[Feature] Exception Path', () => {
  describe('Authentication', () => {
    it('should return 401 when no token provided', async () => {
      const res = await testApp.request('/api/products');
      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token', async () => {
      const res = await testApp.request('/api/products', {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Authorization', () => {
    it('should return 403 when user lacks permission', async () => {
      const token = await getTestToken('viewer');
      const res = await testApp.request('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Test' })
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Validation', () => {
    it('should return 400 when required field missing', async () => {
      const token = await getTestToken('admin');
      const res = await testApp.request('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}) // missing required fields
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when field type invalid', async () => {
      const token = await getTestToken('admin');
      const res = await testApp.request('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Test',
          categoryId: 'not-a-number' // should be number
        })
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Resource Not Found', () => {
    it('should return 404 when resource does not exist', async () => {
      const token = await getTestToken('admin');
      const res = await testApp.request('/api/products/99999', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Conflict', () => {
    it('should return 409 when duplicate entry', async () => {
      const token = await getTestToken('admin');
      // Create first entry
      await testApp.request('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Duplicate Category' })
      });
      // Try to create duplicate
      const res = await testApp.request('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Duplicate Category' })
      });
      expect(res.status).toBe(409);
    });
  });
});
```

---

# Stage 4: Boundary Value Tests

```typescript
describe('[Feature] Boundary Values', () => {
  it('should handle empty list', async () => {
    const token = await getTestToken('admin');
    const res = await testApp.request('/api/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.list).toHaveLength(0);
  });

  it('should handle maximum page size', async () => {
    const token = await getTestToken('admin');
    const res = await testApp.request('/api/products?limit=1000', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
  });

  it('should handle string length limits', async () => {
    const token = await getTestToken('admin');
    const res = await testApp.request('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'A'.repeat(256) // max is 255
      })
    });
    expect(res.status).toBe(400);
  });
});
```

---

# Test Helper Functions

```typescript
// Test utilities
async function getTestToken(role: 'admin' | 'user' | 'viewer' = 'admin'): Promise<string> {
  const res = await testApp.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${role}@test.com`,
      password: 'test123'
    })
  });
  const data = await res.json();
  return data.data.token;
}

async function seedTestData(table: string, data: any[]) {
  for (const item of data) {
    await testDb.insert(table).values(item);
  }
}
```

---

# Coverage Checklist

Before finalizing, verify:

- [ ] All happy path scenarios covered
- [ ] All exception path scenarios covered
- [ ] All boundary value cases tested
- [ ] All acceptance criteria have corresponding tests
- [ ] Test names describe expected behavior clearly
- [ ] No test duplication across modules

---

# Constraints

**MUST DO:**
- Write tests BEFORE module implementation (TDD)
- Cover happy path AND exception path
- Use clear, descriptive test names
- Keep tests independent (no shared state)

**MUST NOT DO:**
- Write tests for unimplemented modules
- Skip authentication/authorization tests
- Write brittle tests with implementation details
- Leave tests empty (describe X, it should Y)

---

# Gotchas

- **Isolation is key** — Each test must be independent, run in any order
- **Setup/Teardown** — Clean up data in beforeEach/afterEach
- **Status codes** — 400 for validation, 401 for auth, 403 for permission, 404 for not found
- **Error response format** — Always check `{ success: false, error: { code, message } }`
- **Soft delete** — Tests should verify deleted items are not returned in list/detail
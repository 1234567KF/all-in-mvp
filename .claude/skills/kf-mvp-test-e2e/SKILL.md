---
name: kf-mvp-test-e2e
description: >-
  Load when user asks to write end-to-end tests, scenario tests, or cross-module
  integration tests. Triggers: 端到端测试, 场景测试, e2e, e2e test,
  业务流程测试, cross-module, 跨模块测试. Also load when PRD business
  flow needs automated testing.
metadata:
  pattern: generator
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-biz-expert
      type: sequential
    - target: kf-mvp-prd-generator
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Testing: Vitest (unit/integration) + Playwright (E2E)
- Backend test: Hono app.request() adapter + SQLite in-memory

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP End-to-End Scenario Test Writer — 业务条线测试编写技能

> **Core Belief**: Single module tests verify interfaces work. E2E tests verify business works. A business story must be told from start to finish, not in fragments.

**Division of Labor**: This Skill focuses on **cross-module scenario test generation** based on PRD business flows. It outputs tests in `integration-tests/scenarios/`. Follows Generator pattern with strict story templates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.6 — ③b-2 业务条线测试:

1. **Business story first** — Tests follow user's journey, not module boundaries
2. **Cross-module flow** — One test may touch multiple modules
3. **Data factory** — Shared test data factory for consistent setup
4. **Single agent** — One test writer for flow consistency (no parallel splitting)

---

# Output Location

```
integration-tests/
└── scenarios/
    └── <scenario>.test.ts   # Cross-module scenario tests
```

---

# E2E vs Single Module Tests

| Dimension | Single Module (③b-1) | E2E Scenario (③b-2) |
|-----------|---------------------|--------------------|
| Scope | One module | Multiple modules |
| Flow | Interface in/out | User journey |
| Test file | `modules/<module>.ts` | `scenarios/<scenario>.ts` |
| Data | Per-module fixtures | Shared factory |
| Parallel | 2 agents max | Single agent |

**Boundary Rule**: If test header reads like "POST /api/xxx" → ③b-1. If test header reads like "User completes action X" → ③b-2

---

# Scenario Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestFactory } from './factories/TestFactory';

describe('[Business Scenario] Marketing to Trace Flow', () => {
  const factory = new TestFactory();

  beforeAll(async () => {
    await factory.setup();
  });

  afterAll(async () => {
    await factory.cleanup();
  });

  it('should complete full marketing trace journey', async () => {
    // Step 1: Login as brand owner
    const brandOwner = await factory.createUser({
      email: 'brand@example.com',
      role: 'brand_owner'
    });
    const brandToken = await factory.login(brandOwner);

    // Step 2: Create product
    const product = await factory.createProduct({
      name: 'Marketing Product',
      category: 'Electronics',
      ownerId: brandOwner.id
    }, brandToken);

    // Step 3: Create marketing activity
    const activity = await factory.createActivity({
      name: 'Summer Sale',
      productId: product.id,
      startDate: '2024-06-01',
      endDate: '2024-08-31'
    }, brandToken);

    // Step 4: Associate product with activity
    await factory.associateProductWithActivity(
      activity.id,
      product.id,
      brandToken
    );

    // Step 5: Generate trace code batch
    const traceCodes = await factory.generateTraceCodes({
      activityId: activity.id,
      productId: product.id,
      quantity: 100
    }, brandToken);

    // Step 6: Assign codes to product batch
    await factory.assignTraceCodes({
      codes: traceCodes,
      batchId: 'BATCH-001'
    }, brandToken);

    // Step 7: Consumer scans code
    const consumer = await factory.createUser({
      email: 'consumer@example.com',
      role: 'consumer'
    });
    const consumerToken = await factory.login(consumer);

    const scanResult = await factory.scanTraceCode({
      code: traceCodes[0],
      consumerId: consumer.id
    }, consumerToken);

    // Assertions
    expect(scanResult.success).toBe(true);
    expect(scanResult.data.product.name).toBe('Marketing Product');
    expect(scanResult.data.activity.name).toBe('Summer Sale');
    expect(scanResult.data.activity.isActive).toBe(true);
  });
});
```

---

# Stage 1: Read PRD Business Flow

**Extract from PRD Section 4: 业务主流程**

1. Identify all business journeys
2. Map each journey to modules it touches
3. Note required preconditions
4. Identify key assertions

**Output**:
```markdown
## 业务场景清单

| 场景名 | 涉及模块 | 用户角色 | 关键断言 |
|--------|----------|----------|----------|
| 品牌商创建营销活动 | user, product, activity | brand_owner | 活动创建成功 |
| 消费者扫码溯源 | trace, product, activity | consumer | 显示营销信息 |
| 赋码到产品批次 | trace, product, template | brand_owner | 码段关联正确 |
```

---

# Stage 2: Test Factory Setup

```typescript
// integration-tests/scenarios/factories/TestFactory.ts
export class TestFactory {
  private app: Hono;
  private db: Database;

  async setup() {
    this.db = sqliteMemory();
    this.app = new Hono();
    setupTestRoutes(this.app);
  }

  async cleanup() {
    await this.db.close();
  }

  async createUser(data: CreateUserData): Promise<User> {
    const res = await this.app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return result.data;
  }

  async login(user: User): Promise<string> {
    const res = await this.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: 'password123'
      })
    });
    const result = await res.json();
    return result.data.token;
  }

  async createProduct(data: CreateProductData, token: string): Promise<Product> {
    const res = await this.app.request('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return result.data;
  }

  async createActivity(data: CreateActivityData, token: string): Promise<Activity> {
    const res = await this.app.request('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return result.data;
  }

  async generateTraceCodes(data: GenerateCodesData, token: string): Promise<string[]> {
    const res = await this.app.request('/api/trace/codes/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return result.data.codes;
  }

  async assignTraceCodes(data: AssignCodesData, token: string): Promise<void> {
    const res = await this.app.request('/api/trace/codes/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    expect(res.status).toBe(200);
  }

  async scanTraceCode(data: ScanCodeData, token: string): Promise<ScanResult> {
    const res = await this.app.request(`/api/trace/scan/${data.code}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await res.json();
    return result.data;
  }
}
```

---

# Stage 3: Scenario Test Template

```typescript
// integration-tests/scenarios/marketing-to-trace.test.ts
describe('[Scenario] Marketing to Trace Flow', () => {
  const factory = new TestFactory();

  beforeAll(async () => {
    await factory.setup();
  });

  afterAll(async () => {
    await factory.cleanup();
  });

  describe('Step 1: Brand Owner Login', () => {
    it('should login as brand owner', async () => {
      const user = await factory.createUser({
        email: 'brand@example.com',
        role: 'brand_owner'
      });
      const token = await factory.login(user);
      expect(token).toBeDefined();
    });
  });

  describe('Step 2: Create Product and Marketing Activity', () => {
    it('should create product and associate with activity', async () => {
      // ... implementation
    });
  });

  describe('Step 3: Generate and Assign Trace Codes', () => {
    it('should generate trace codes and assign to batch', async () => {
      // ... implementation
    });
  });

  describe('Step 4: Consumer Scan and Verify', () => {
    it('should display marketing info when consumer scans', async () => {
      // ... implementation
    });
  });
});
```

---

# Stage 4: Assertions for Business Logic

```typescript
// Key business assertions
describe('[Scenario] Business Rules', () => {
  it('should enforce activity date validity', async () => {
    const brandToken = await factory.getBrandOwnerToken();
    
    // Try to create expired activity
    const res = await factory.createActivity({
      name: 'Expired Sale',
      productId: product.id,
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    }, brandToken);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_DATE_RANGE');
  });

  it('should prevent trace code reuse', async () => {
    const codes = await factory.generateTraceCodes({
      activityId: activity.id,
      productId: product.id,
      quantity: 1
    }, brandToken);

    const firstScan = await factory.scanTraceCode({
      code: codes[0],
      consumerId: consumer.id
    }, consumerToken);

    // Second scan of same code
    const secondScan = await factory.scanTraceCode({
      code: codes[0],
      consumerId: anotherConsumer.id
    }, anotherConsumerToken);

    expect(secondScan.data.alreadyScanned).toBe(true);
    expect(secondScan.data.firstScanTime).toBeDefined();
  });
});
```

---

# Scenario Test Types

| Type | Description | Example |
|------|-------------|---------|
| **User Journey** | Complete user workflow | 消费者扫码查看溯源 |
| **Business Rule** | Cross-module rule enforcement | 活动有效期检查 |
| **Edge Case** | Unusual but possible scenarios | 同一码被多次扫描 |
| **Security** | Permission boundary tests | 未授权用户访问 |

---

# Quality Checklist

- [ ] Scenario covers full PRD business flow
- [ ] All cross-module interactions tested
- [ ] Test data factory is used (not hardcoded IDs)
- [ ] Assertions verify business outcomes, not just API responses
- [ ] Error scenarios are covered
- [ ] Test is self-contained (no external dependencies)

---

# Constraints

**MUST DO:**
- Test from user's perspective, not API perspective
- Use shared TestFactory for consistent data
- Cover the complete story, not fragments
- Include both success and failure paths

**MUST NOT DO:**
- Split scenario tests across agents (one story = one writer)
- Test single module in isolation (that's ③b-1)
- Hardcode test data (use factory)
- Skip assertions for business rules

---

# Gotchas

- **Order matters** — E2E tests are linear, setup must precede assertions
- **Data isolation** — Each scenario should clean up after itself
- **Token refresh** — Tests with long wait may need token refresh
- **Foreign key order** — Create entities in dependency order
- **Soft delete in E2E** — Deleted items may still exist in other module's cache
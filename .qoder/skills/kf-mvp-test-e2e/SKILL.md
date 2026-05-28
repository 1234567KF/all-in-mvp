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
- **Boundary with ③b-1** — 测试文件抬头看接口名（`POST /api/xxx`）→ ③b-1；抬头看角色旅程（"以某角色完成某事"）→ ③b-2

---

# ③b-1 与 ③b-2 边界仲裁规则

> 当测试应归属哪一方不明确时，按以下规则判定：

| 判定条件 | 归属 | 原因 |
|---------|------|------|
| 测试只涉及单个模块的数据库读写 + 接口参数校验 | **③b-1** | 单模块职责 |
| 测试覆盖多模块协作但不涉及 PRD 定义的业务主流程 | **③b-1** | 按模块拆分各自覆盖 |
| 测试覆盖 PRD「业务主流程」中定义的完整用户旅程 | **③b-2（本项目）** | 场景测试核心职责 |
| 边界不清时（如单模块异常路径需要跨模块数据） | ③b-1 写骨架 + 标记 TODO，③b-2 在对应场景中补全 | 分工不阻塞 |

**粗判原则**：
```
测试文件抬头看：
  ├── 接口名（POST /api/xxx）→ ③b-1 单模块测试
  └── 角色旅程（"以某角色完成某事"）→ ③b-2 业务条线测试（本项目）
```

**协作模式**：收到 ③b-1 标记的 TODO 后：
1. 在对应场景测试中补全跨模块数据准备
2. 确保 ③b-1 的骨架在完整流程中可正确执行
3. 不重复测试 ③b-1 已覆盖的单模块接口验证

---

# 视觉回归测试（v2.5 新增）

> **核心问题**：E2E 测试的 DOM 文本断言无法发现 CSS 布局错误、颜色错误、元素遮挡等视觉问题。LLM 无视觉能力，必须靠自动化工具补强。

> **分工**：视觉回归测试归属 ③b-2（业务条线测试），因为视觉正确性是完整用户旅程的一部分——用户看到的不只是数据，还是布局、颜色、交互反馈。

---

## 视觉测试与功能测试的边界

| 维度 | 功能 E2E | 视觉回归 |
|------|---------|---------|
| 问题 | "提交订单后是否跳转到订单页？" | "订单确认按钮是否是蓝色 #3B82F6？" |
| 断言 | `expect(page).toHaveURL(/orders/)` | `expect(btn).toHaveCSS('background-color', 'rgb(59, 130, 246)')` |
| 工具 | Playwright 功能断言 | Playwright computed style + toHaveScreenshot |
| 归属 | ③b-2 业务条线 | ③b-2 业务条线（视觉子集） |

---

## 视觉断言模板

```typescript
// integration-tests/scenarios/visual/<scenario>.visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('[Visual] Consumer Scan Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');
  });

  test('scan result page — product info card colors', async ({ page }) => {
    // 模拟扫描结果加载
    await page.locator('[data-testid="scan-input"]').fill('TRACE-001');
    await page.locator('[data-testid="btn-scan"]').click();
    await page.waitForSelector('[data-testid="scan-result"]');

    // V1: computed style 断言
    const card = page.locator('[data-testid="product-card"]');
    await expect(card).toHaveCSS('border-color', 'rgb(229, 231, 235)');
    await expect(card).toHaveCSS('border-radius', '8px');

    const title = page.locator('[data-testid="product-name"]');
    await expect(title).toHaveCSS('font-size', '18px');
    await expect(title).toHaveCSS('font-weight', '600');

    // V2: 像素快照
    await expect(page.locator('[data-testid="scan-result"]'))
      .toHaveScreenshot('scan-result-product.png', { maxDiffPixels: 100 });
  });

  test('scan result — marketing activity badge', async ({ page }) => {
    await page.locator('[data-testid="scan-input"]').fill('TRACE-002');
    await page.locator('[data-testid="btn-scan"]').click();
    await page.waitForSelector('[data-testid="activity-badge"]');

    const badge = page.locator('[data-testid="activity-badge"]');
    // 营销活动标签必须是红色
    await expect(badge).toHaveCSS('background-color', 'rgb(239, 68, 68)');
    await expect(page).toHaveScreenshot('scan-activity-badge.png');
  });

  test('responsive layout — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('[data-testid="scan-input"]').fill('TRACE-001');
    await page.locator('[data-testid="btn-scan"]').click();

    // V3: 移动端无元素重叠
    const overlaps = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="product-card"]');
      const result = [];
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i].getBoundingClientRect();
          const b = cards[j].getBoundingClientRect();
          if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) {
            result.push(`card[${i}] ↔ card[${j}]`);
          }
        }
      }
      return result;
    });
    expect(overlaps).toHaveLength(0);

    await expect(page).toHaveScreenshot('scan-mobile.png', { maxDiffPixels: 50 });
  });
});
```

---

## 多分辨率视觉覆盖矩阵

每个关键业务页面必须覆盖：

| 分辨率 | 宽度 | 类型 | 说明 |
|--------|------|------|------|
| Desktop | 1920×1080 | 主要视图 | 标准桌面端 |
| Laptop | 1366×768 | 次要视图 | 常见笔记本 |
| Tablet | 768×1024 | 可选 | 平板横屏 |
| Mobile | 375×812 | 可选 | 手机（如有移动端需求） |

---

## 视觉测试文件位置

```
integration-tests/
├── modules/                          # ③b-1 单模块测试
├── scenarios/                        # ③b-2 业务条线测试
│   ├── <scenario>.test.ts            # 功能E2E
│   └── visual/                       # 视觉回归测试（归属 ③b-2）
│       ├── <scenario>.visual.spec.ts # computed style + 像素快照
│       └── <scenario>-snapshots/     # 基线截图（提交到 Git）
└── helpers.ts
```
---
name: kf-mvp-test-e2e
description: >-
  Load when user asks to write end-to-end tests, scenario tests, or cross-module
  integration tests. Triggers: 端到端测�? 场景测试, e2e, e2e test,
  业务流程测试, cross-module, 跨模块测�? Also load when PRD business
  flow needs automated testing.
metadata:
  pattern: generator
  domain: mvp-stage2,mvp-stage3
recommended_model: minimax-m2.7
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


# MVP End-to-End Scenario Test Writer �?业务条线测试编写技�?

> **Core Belief**: Single module tests verify interfaces work. E2E tests verify business works. A business story must be told from start to finish, not in fragments. And after implementation, tests MUST adapt to reality.

**Division of Labor**: This Skill has TWO phases:
1. **E2E-Write** (Stage 2): Cross-module scenario test generation based on PRD business flows. Outputs `integration-tests/scenarios/`.
2. **E2E-Adapt** (Stage 3.5): Adapt existing E2E tests to match actual backend implementation after all modules DONE. Fixes contract drift, fills coverage gaps, ensures ≥70 cases.

Follows Generator pattern with strict story templates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.6 �?③b-2 业务条线测试:

1. **Business story first** �?Tests follow user's journey, not module boundaries
2. **Cross-module flow** �?One test may touch multiple modules
3. **Data factory** �?Shared test data factory for consistent setup
4. **Single agent** �?One test writer for flow consistency (no parallel splitting)

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

**Boundary Rule**: If test header reads like "POST /api/xxx" �?③b-1. If test header reads like "User completes action X" �?③b-2

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

**Extract from PRD Section 4: 业务主流�?*

1. Identify all business journeys
2. Map each journey to modules it touches
3. Note required preconditions
4. Identify key assertions

**Output**:
```markdown
## 业务场景清单

| 场景�?| 涉及模块 | 用户角色 | 关键断言 |
|--------|----------|----------|----------|
| 品牌商创建营销活动 | user, product, activity | brand_owner | 活动创建成功 |
| 消费者扫码溯�?| trace, product, activity | consumer | 显示营销信息 |
| 赋码到产品批�?| trace, product, template | brand_owner | 码段关联正确 |
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
| **User Journey** | Complete user workflow | 消费者扫码查看溯�?|
| **Business Rule** | Cross-module rule enforcement | 活动有效期检�?|
| **Edge Case** | Unusual but possible scenarios | 同一码被多次扫描 |
| **Security** | Permission boundary tests | 未授权用户访�?|

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

- **Order matters** �?E2E tests are linear, setup must precede assertions
- **Data isolation** �?Each scenario should clean up after itself
- **Token refresh** �?Tests with long wait may need token refresh
- **Foreign key order** �?Create entities in dependency order
- **Soft delete in E2E** �?Deleted items may still exist in other module's cache
- **Boundary with ③b-1** �?测试文件抬头看接口名（`POST /api/xxx`）→ ③b-1；抬头看角色旅程�?以某角色完成某事"）→ ③b-2

---

# ③b-1 �?③b-2 边界仲裁规则

> 当测试应归属哪一方不明确时，按以下规则判定：

| 判定条件 | 归属 | 原因 |
|---------|------|------|
| 测试只涉及单个模块的数据库读�?+ 接口参数校验 | **③b-1** | 单模块职�?|
| 测试覆盖多模块协作但不涉�?PRD 定义的业务主流程 | **③b-1** | 按模块拆分各自覆�?|
| 测试覆盖 PRD「业务主流程」中定义的完整用户旅�?| **③b-2（本项目�?* | 场景测试核心职责 |
| 边界不清时（如单模块异常路径需要跨模块数据�?| ③b-1 写骨�?+ 标记 TODO，③b-2 在对应场景中补全 | 分工不阻�?|

**粗判原则**�?
```
测试文件抬头看：
  ├── 接口名（POST /api/xxx）→ ③b-1 单模块测�?
  └── 角色旅程�?以某角色完成某事"）→ ③b-2 业务条线测试（本项目�?
```

**协作模式**：收�?③b-1 标记�?TODO 后：
1. 在对应场景测试中补全跨模块数据准�?
2. 确保 ③b-1 的骨架在完整流程中可正确执行
3. 不重复测�?③b-1 已覆盖的单模块接口验�?

---

# 视觉回归测试（v2.5 新增�?

> **核心问题**：E2E 测试�?DOM 文本断言无法发现 CSS 布局错误、颜色错误、元素遮挡等视觉问题。LLM 无视觉能力，必须靠自动化工具补强�?

> **分工**：视觉回归测试归�?③b-2（业务条线测试），因为视觉正确性是完整用户旅程的一部分——用户看到的不只是数据，还是布局、颜色、交互反馈�?

---

## 视觉测试与功能测试的边界

| 维度 | 功能 E2E | 视觉回归 |
|------|---------|---------|
| 问题 | "提交订单后是否跳转到订单页？" | "订单确认按钮是否是蓝�?#3B82F6�? |
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

  test('scan result page �?product info card colors', async ({ page }) => {
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

  test('scan result �?marketing activity badge', async ({ page }) => {
    await page.locator('[data-testid="scan-input"]').fill('TRACE-002');
    await page.locator('[data-testid="btn-scan"]').click();
    await page.waitForSelector('[data-testid="activity-badge"]');

    const badge = page.locator('[data-testid="activity-badge"]');
    // 营销活动标签必须是红�?
    await expect(badge).toHaveCSS('background-color', 'rgb(239, 68, 68)');
    await expect(page).toHaveScreenshot('scan-activity-badge.png');
  });

  test('responsive layout �?mobile viewport', async ({ page }) => {
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
            result.push(`card[${i}] �?card[${j}]`);
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

每个关键业务页面必须覆盖�?

| 分辨�?| 宽度 | 类型 | 说明 |
|--------|------|------|------|
| Desktop | 1920×1080 | 主要视图 | 标准桌面�?|
| Laptop | 1366×768 | 次要视图 | 常见笔记�?|
| Tablet | 768×1024 | 可�?| 平板横屏 |
| Mobile | 375×812 | 可�?| 手机（如有移动端需求） |

---

## 视觉测试文件位置

```
integration-tests/
├── modules/                          # ③b-1 单模块测�?
├── scenarios/                        # ③b-2 业务条线测试
�?  ├── <scenario>.test.ts            # 功能E2E
�?  └── visual/                       # 视觉回归测试（归�?③b-2�?
�?      ├── <scenario>.visual.spec.ts # computed style + 像素快照
�?      └── <scenario>-snapshots/     # 基线截图（提交到 Git�?
└── helpers.ts
```

---

# 阻塞场景必测清单（v2.6 强制）

> **页面可打开 ≠ 功能正确。以下场景必须覆盖，否则 Stage4 门禁不通过。**

## 1. 登录流程必测

| 场景 | 用例数 | 说明 |
|------|:------:|------|
| 正常登录（每角色） | N | 每个角色类型至少1个 |
| 错误密码 | 1 | 验证错误提示 |
| 空字段提交 | 1 | 验证前端校验 |
| 登录后跳转 | 1 | 验证重定向逻辑 |
| 退出登录 | 1 | 验证Token清除 |
| 改密后登录 | 3 | 旧密码失败+新密码成功+强制改密 |
| 找回密码 | 1 | 验证重置流程 |

## 2. 菜单导航必测

| 场景 | 用例数 | 说明 |
|------|:------:|------|
| 菜单完整性 | 1 | 所有菜单项可点击 |
| 菜单权限 | N | 每个角色只能看到授权菜单 |
| 页面跳转 | 1 | 点击菜单后页面正确加载 |
| 404处理 | 1 | 不存在的路由显示友好提示 |
| 面包屑 | 1 | 导航路径正确 |

## 3. CRUD完整闭环必测

| 场景 | 用例数 | 说明 |
|------|:------:|------|
| 创建成功 | 1 | 填写表单→提交→列表可见 |
| 创建失败 | 1 | 必填字段缺失→错误提示 |
| 列表展示 | 1 | 数据正确分页、排序 |
| 详情查看 | 1 | 点击列表项→详情页数据正确 |
| 编辑成功 | 1 | 修改→保存→列表更新 |
| 删除成功 | 1 | 删除→确认→列表移除 |
| 删除确认 | 1 | 取消删除→数据保留 |

## 4. 数据权限必测

| 场景 | 用例数 | 说明 |
|------|:------:|------|
| 数据隔离 | 1 | 不同角色只能看到授权数据 |
| 跨角色操作 | 1 | 无权限操作返回403 |
| 管理员权限 | 1 | 管理员可查看所有数据 |

---

# 账号准备自修复模式（v2.6 强制）

> **测试账号可能处于脏状态（密码被改、账号被禁用）。账号准备函数必须能自动修复。**

## ensureAccountReady 函数模板

```typescript
// integration-tests/helpers/account-helper.ts
export async function ensureAccountReady(
  request: APIRequestContext,
  phone: string,
  entryType: string,
  password: string = '123456'
): Promise<{ token: string; user: any }> {
  
  const API = process.env.API_BASE_URL || 'http://localhost:3000';
  
  // 尝试 1: 直接登录
  let resp = await request.post(`${API}/auth/login`, {
    data: { phone, password, entryType }
  });
  let result = await resp.json();
  
  if (result.token) {
    return { token: result.token, user: result.user };
  }
  
  // 尝试 2: 密码被改 → 自动重置
  if (result.error?.code === 'INVALID_PASSWORD' || result.error?.code === 'ACCOUNT_LOCKED') {
    console.log(`[AccountHelper] 密码错误或账号锁定，尝试重置: ${phone}`);
    
    // 调用忘记密码接口
    await request.post(`${API}/auth/forgot-password`, {
      data: { phone }
    });
    
    // 使用默认密码重试
    resp = await request.post(`${API}/auth/login`, {
      data: { phone, password: '123456', entryType }
    });
    result = await resp.json();
    
    if (result.token) {
      return { token: result.token, user: result.user };
    }
  }
  
  // 尝试 3: 账号不存在 → 创建
  if (result.error?.code === 'USER_NOT_FOUND') {
    console.log(`[AccountHelper] 账号不存在，创建新账号: ${phone}`);
    
    const createResp = await request.post(`${API}/users`, {
      data: {
        phone,
        password: '123456',
        name: `Test User ${phone.slice(-4)}`,
        role: entryType
      }
    });
    const createResult = await createResp.json();
    
    if (createResult.token) {
      return { token: createResult.token, user: createResult.user };
    }
  }
  
  // 尝试 4: 仍失败 → 抛出明确错误
  throw new Error(
    `[AccountHelper] 账号准备失败: ${phone}\n` +
    `错误: ${JSON.stringify(result.error)}\n` +
    `请检查: 1) API服务是否启动 2) 数据库是否初始化 3) 种子数据是否执行`
  );
}

// 批量准备账号
export async function ensureAccountsReady(
  request: APIRequestContext,
  accounts: Array<{ phone: string; entryType: string }>
): Promise<Map<string, { token: string; user: any }>> {
  
  const results = new Map();
  
  for (const account of accounts) {
    const result = await ensureAccountReady(request, account.phone, account.entryType);
    results.set(account.phone, result);
  }
  
  return results;
}

// 重置所有测试账号到初始状态
export async function resetTestAccounts(
  request: APIRequestContext,
  accounts: Array<{ phone: string; entryType: string }>
): Promise<void> {
  
  const API = process.env.API_BASE_URL || 'http://localhost:3000';
  
  for (const account of accounts) {
    // 尝试重置密码
    await request.post(`${API}/auth/reset-password`, {
      data: {
        phone: account.phone,
        newPassword: '123456'
      }
    });
    
    // 尝试启用账号
    await request.put(`${API}/users/${account.phone}/status`, {
      data: { status: 'active' }
    });
  }
}
```

## 使用示例

```typescript
describe('Admin Dashboard', () => {
  let adminToken: string;
  let adminUser: any;
  
  beforeAll(async ({ request }) => {
    // 自动修复账号状态
    const result = await ensureAccountReady(request, '13800138000', 'admin');
    adminToken = result.token;
    adminUser = result.user;
  });
  
  // 测试用例...
});
```

---

# 全流程深度测试（v2.7 强制）

> **页面可打开 ≠ 功能正确。每个角色必须测完整的"创建→提交→验证→列表可见"闭环。**

## 角色全流程测试矩阵

| 角色 | 必测全流程 | 最少用例 |
|------|-----------|:------:|
| 管理员 | 登录 → 查看统计 → 创建角色 → 创建账号 → 审核商机(通过+驳回+撤销) → 商机调配 → 查看汇总 | 8 |
| 销售人员 | 登录 → 创建渠道 → 创建客户(关联渠道) → 创建商机 → 查看我的商机 → 商机跟进 → 查看汇总 | 7 |
| 渠道人员 | 登录 → 创建客户 → 报备商机 → 查看商机列表 → 查看商机状态 → 验证数据隔离 | 6 |

## 工作流测试文件组织

```
tests/e2e/
├── helpers.ts              # 共享辅助函数（账号准备、登录、导航）
├── auth.spec.ts            # 登录认证（每角色 + 错误路径 + 改密）
├── dashboard-navigation.spec.ts  # 首页 + 导航 + 布局
├── roles-accounts.spec.ts  # 角色管理 + 账号管理
├── channels.spec.ts        # 渠道管理
├── customers.spec.ts       # 客户管理
├── opportunities.spec.ts   # 商机管理（最复杂，用例最多）
├── workflows-internal.spec.ts  # 内部全流程（管理员+销售）
└── workflows-partner.spec.ts   # 合作伙伴全流程（渠道人员）
```

## 工作流测试模板

```typescript
// tests/e2e/workflows-internal.spec.ts
test.describe('[Workflow] 内部用户全流程', () => {
  let adminToken: string;
  let salesToken: string;
  
  test.beforeAll(async ({ request }) => {
    // 准备账号
    const admin = await ensureAccountReady(request, '13800138000', 'admin');
    adminToken = admin.token;
    
    const sales = await ensureAccountReady(request, '13800138001', 'sales');
    salesToken = sales.token;
  });
  
  test('管理员: 创建角色 → 创建账号 → 审核商机', async ({ page }) => {
    // Step 1: 登录
    await page.goto('/login');
    await page.fill('[name="phone"]', '13800138000');
    await page.fill('[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
    
    // Step 2: 创建角色
    await page.goto('/roles');
    await page.click('text=新建角色');
    await page.fill('[name="name"]', '测试角色');
    await page.click('text=保存');
    await expect(page.locator('text=测试角色')).toBeVisible();
    
    // Step 3: 创建账号
    await page.goto('/accounts');
    await page.click('text=新建账号');
    await page.fill('[name="phone"]', '13800138099');
    await page.fill('[name="name"]', '测试账号');
    await page.selectOption('[name="role"]', '测试角色');
    await page.click('text=保存');
    await expect(page.locator('text=测试账号')).toBeVisible();
    
    // Step 4: 审核商机
    await page.goto('/opportunities/pending');
    await page.click('text=第一个待审核商机');
    await page.click('text=通过');
    await page.fill('[name="comment"]', '审核通过');
    await page.click('text=确认');
    await expect(page.locator('text=审核成功')).toBeVisible();
  });
  
  test('销售人员: 创建渠道 → 创建客户 → 创建商机', async ({ page }) => {
    // 类似结构...
  });
});
```

## 工作流测试强制要求

- MUST 用 API 直接创建数据（避免前端表单选择器的不稳定性）
- MUST 验证创建的数据出现在对应列表/详情中
- MUST 覆盖每个角色的核心业务闭环
- MUST 验证跨角色数据隔离
- MUST 在 beforeAll 中确保账号就绪（firstLogin 已处理）

---

# E2E覆盖率检查清单（Stage4门禁）

- [ ] 每个 API 端点至少 1 个 Happy Path + 1 个 Error Path 用例
- [ ] 每个角色至少 1 个权限校验用例
- [ ] 每个表单至少 1 个空字段提交 + 1 个正常提交用例
- [ ] 状态机每个状态转换至少 1 个用例
- [ ] 数据隔离至少 1 个跨角色验证用例
- [ ] 登录流程至少 12 个用例
- [ ] 菜单导航至少 5 个用例
- [ ] 每个CRUD模块至少 7 个用例
- [ ] 工作流测试至少 21 个用例（管理员8+销售7+渠道6）
- [ ] 总用例数 ≥ 70（全量模式）

---

# E2E-Adapt 阶段：实现后适配（Stage 3.5）

> **触发时机**：Stage 3 所有后端模块 DONE 后、Stage 4 集成前。
> **目标**：将 Stage 2 基于 PRD 编写的 E2E 骨架适配到实际实现，修复契约漂移，补齐覆盖缺口。
> **模型分配**：pro（**MUST NOT 使用 flash**，≥70 用例需要深度推理）

---

## 适配流程

```
阶段 A: 差异扫描 (pro)
  → 输入: api-contract.yaml【锁定版】+ 实际 API 路由文件
  → 检测: API 路径变化 / 字段名变化 / 枚举值变化 / 响应格式变化
  → 输出: contract-drift-log.md（差异清单）

阶段 B: E2E 用例修正 (pro)
  → 输入: 已有 E2E 文件 + contract-drift-log.md
  → 动作: 逐文件修正 API 路径、字段名、枚举值
  → 规则: 不改测试意图，只改 API 调用细节

阶段 C: 覆盖缺口补齐 (pro)
  → 运行: node scripts/check-e2e-coverage.js --json
  → 分析: 识别未达标分类
  → 动作: 按优先级补齐用例（登录 > 工作流 > CRUD > 导航 > 数据隔离）
  → 验证: 再次运行 check-e2e-coverage.js --ci 确认通过

阶段 D: 首次运行验证 (pro)
  → 启动后端服务 + Mock 数据
  → 运行全部 E2E 测试（L5 headless）
  → 记录失败到 e2e-first-run-issues.md
  → 区分: E2E 测试 Bug vs 后端实现 Bug
  → 后端 Bug → 标记 BLOCKED，通知对应模块 Agent
  → E2E Bug → 本阶段修复

阶段 E: 产出 E2E_READY 标记
  → 创建 integration-tests/scenarios/E2E_READY 文件
  → 内容：覆盖报告摘要 + 适配轮次 + 时间戳
  → Coordinator 检测到此标记后才允许进入 Stage 4
```

---

## E2E_READY 标记文件格式

```json
{
  "stage": "3.5",
  "phase": "E2E-Adapt",
  "timestamp": "2026-07-02T12:00:00Z",
  "total_cases": 74,
  "coverage": {
    "login": 13,
    "navigation": 6,
    "crud": 28,
    "workflow": 22,
    "dataIsolation": 3
  },
  "adaptation_rounds": 2,
  "contract_drifts_fixed": 5,
  "gaps_filled": 12,
  "status": "READY"
}
```

---

## 适配约束

**MUST DO:**
- 基于实际 API 路由修正（不是基于 PRD 猜测）
- 每个修正验证 API 确实返回该字段/格式
- 补齐用例前必须先 `check-e2e-coverage.js --json` 确认缺口
- E2E-Adapt 完成后创建 E2E_READY 标记
- 使用 pro 模型（NOT flash）

**MUST NOT DO:**
- 修改测试的业务意图（只改 API 细节）
- 删除因后端 Bug 失败的用例（改为标记 skip + 记录到 e2e-first-run-issues.md）
- 跳过覆盖缺口（必须补齐到 ≥70）
- 在没有 E2E_READY 标记的情况下进入 Stage 4

---

## contract-drift-log.md 模板

```markdown
# Contract Drift Log — E2E 适配

**生成时间**: [ISO datetime]
**对比基准**: api-contract.yaml【锁定版】
**实际来源**: src/modules/*/routes.ts

## 差异清单

| # | 类型 | PRD 定义 | 实际实现 | 影响 E2E 文件 | 已修复 |
|---|------|---------|---------|-------------|--------|
| 1 | 路径变化 | POST /api/auth/login | POST /api/login | auth.spec.ts | ✅ |
| 2 | 字段名 | user.role | user.roleType | roles-accounts.spec.ts | ✅ |
| 3 | 枚举值 | status: 'pending' | status: 'PENDING' | opportunities.spec.ts | ✅ |

## 统计
- 总差异: N
- 已修复: N
- 需后端确认: N
```

---

## E2E-Adapt 与 Stage 4 的关系

```
Stage 3 全部模块 DONE
    │
    ▼
Stage 3.5 E2E-Adapt（本技能）
    ├── 扫描契约漂移 → 修正 E2E
    ├── 补齐覆盖缺口 → ≥70 用例
    ├── 首次运行验证 → 记录真实 Bug
    └── 产出 E2E_READY 标记
    │
    ▼
Stage 4 集成与验收
    ├── check-e2e-coverage.js --ci 自动通过（E2E_READY 已保证）
    ├── 后端合并 + 联调
    ├── 回归 E2E 全部用例
    └── check-e2e-parity.js --ci 有头/无头验证
```

> **关键**：Stage 4 不再需要补齐 E2E 用例——这个工作在 Stage 3.5 已完成。Stage 4 只需验证已有 E2E 全部通过。
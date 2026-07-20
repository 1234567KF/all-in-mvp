---
name: kf-mvp-test-e2e
description: >-
  Load when user asks to write end-to-end tests, scenario tests, or cross-module
  integration tests. Triggers: 端到端测�? 场景测试, e2e, e2e test,
  业务流程测试, cross-module, 跨模块测�? Also load when PRD business
  flow needs automated testing.
metadata:
  pattern: generator
  domain: mvp-stage2
recommended_model: mino-v2.5-pro
graph:
  dependencies:
    - target: kf-mvp-biz-expert
      type: sequential
    - target: kf-mvp-prd-generator
      type: sequential
    - target: kf-mvp-playwright-infra
      type: semantic
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Testing: Vitest (unit/integration) + Playwright (E2E)
- Backend test: Hono app.request() adapter + SQLite in-memory

> **Infrastructure Note**: Playwright 配置（headed/headless、CI、截图基线、浏览器实例池、storageState）统一由 `kf-mvp-playwright-infra` 技能管理。本技能聚焦测试用例编写，不重复基础设施配置。

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP End-to-End Scenario Test Writer �?业务条线测试编写技�?

> **Core Belief**: Single module tests verify interfaces work. E2E tests verify business works. A business story must be told from start to finish, not in fragments.

**Division of Labor**: This Skill focuses on **cross-module scenario test generation** based on PRD business flows. It outputs tests in `integration-tests/scenarios/`. Follows Generator pattern with strict story templates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.6 �?③b-2 业务条线测试:

1. **Business story first** �?Tests follow user's journey, not module boundaries
2. **Cross-module flow** �?One test may touch multiple modules
3. **Data factory** �?Shared test data factory for consistent setup
4. **Single agent** �?One test writer for flow consistency (no parallel splitting)

---

## PRD 驱动场景设计方法论（复盘 D-08 — 4 步流程）

> **核心问题**：原 E2E 设计从"功能模块"视角出发，仅覆盖约 56% PRD 业务规则。本方法论将设计锚点从"模块"切换到"PRD 业务规则"。

### Step 1: PRD 逐章节提取可测断言
- 读取 PRD 全文，逐章节标注每条业务规则
- 每条规则判断：是否可通过 API/UI 验证？预期行为是什么？
- 输出「PRD 章节 → 测试断言」对照表

### Step 2: 按业务能力分组（非功能模块）
- 将断言按业务能力分组：认证登录、渠道生命周期、客户生命周期、商机创建审核、商机跟进、权限角色...
- 每组包含：创建 + 更新 + 权限边界 + 状态流转 + 异常路径
- 避免仅覆盖"创建"流程（复盘 D-06/D-07 根因）

### Step 3: 生成覆盖矩阵
- 每个场景标注：PRD 章节来源、优先级（P0=核心/P1=边界）、实现状态
- 强制检查：每个 PRD 章节 ≥ 1 场景？每个业务能力 ≥ 1 P0？
- 输出覆盖统计：场景总数 / PRD 章节覆盖率 / 各能力组场景分布

### Step 4: 对照设计文档反向校验
- 将设计文档条目数与场景数对比（可解决复盘 D-01）
- 未覆盖区域 → 补充场景（可解决复盘 D-06/D-07）
- **此步骤必须在 Stage 2 完成，不可推迟到 Stage 4**

> **强制规则**：Stage 2 交付物必须包含「PRD → 场景 追溯矩阵」。Stage 4 验收时对照矩阵逐条确认，禁止自行缩减范围。

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
- [ ] **CRUD 完整生命周期（复盘 D-06）**：每个资源至少覆盖 创建+读取+更新+删除+权限边界
- [ ] **角色权限生效链路（复盘 D-07）**：角色配置→用户登录→菜单/功能验证 完整链路

---

# Constraints

**MUST DO:**
- Test from user's perspective, not API perspective
- Use shared TestFactory for consistent data
- Cover the complete story, not fragments
- Include both success and failure paths
- **每个 CRUD 实体 ≥ 1 个更新操作测试**（复盘 D-06：仅测"创建"遗漏更新，导致 Zod null 容错 Bug 未被发现）
- **每个角色/权限定义 ≥ 1 个权限生效链路测试**（复盘 D-07：仅测数据隔离遗漏角色→菜单链路，导致硬编码权限 Bug 未被发现）

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

# E2E 常见技术障碍预检表（复盘 D-04）

> **Stage 3 开发阶段就应完成此检查，而非推迟到 Stage 4 E2E 执行时才修复。**

| 障碍类型 | 症状 | 解决方案 |
|---------|------|---------|
| Windows 文件锁 | EBUSY: resource busy or locked, SQLite 文件被占用 | 使用 DROP TABLE 替代 unlinkSync 清理 SQLite 数据库 |
| localStorage 不可用 | SecurityError: The operation is insecure | 使用 Playwright `request` fixture 直接调用后端 API，绕过 `page.evaluate` 写 localStorage |
| 角色/权限依赖 | POST /accounts 因角色不存在而 4xx | 测试前验证 seed 数据完整性，按依赖顺序创建：roles → users → 业务数据 |
| Zod enum 不匹配 | productName / status 值与 Schema enum 不一致 | 测试前验证 test data 中的枚举值与 Zod schema 定义严格一致 |
| 认证 token 过期 | 长流程测试中 401 Unauthorized | 使用 `ensureAccountReady()` 自修复模式，每个 `beforeAll` 重新获取 token |
| 端口被占用 | EADDRINUSE: address already in use | 启动前 `taskkill /F /IM node.exe` 清理旧进程 |
| tsconfig 路径别名 | Cannot find module '@wecrm/shared' | 测试前执行 `bun run build` 验证构建配置正确 |

> **P0 红线**：Stage 4 首次 E2E 执行遇到 3+ 技术障碍 → 流程缺陷，说明 Stage 3 的 E2E 就绪检查未执行。纳入复盘。

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

# Playwright API 最佳实践（v2.8 新增）

> **定位**：`kf-mvp-playwright-infra` 管理配置，本节聚焦 **测试编写时的 Playwright API 用法**。

---

## 1. Locator 优先级策略

> **核心原则**：越接近用户视角的选择器越稳定。CSS 类名会变，用户看到的文本和角色不会。

| 优先级 | 选择器 | 示例 | 说明 |
|:------:|--------|------|------|
| 1 (最高) | `data-testid` | `page.locator('[data-testid="btn-submit"]')` | 专为测试设计，不受重构影响 |
| 2 | `getByRole` | `page.getByRole('button', { name: '提交' })` | 语义化，符合无障碍标准 |
| 3 | `getByText` | `page.getByText('确认删除')` | 用户可见文本 |
| 4 | `getByLabel` | `page.getByLabel('用户名')` | 表单字段 |
| 5 | `getByPlaceholder` | `page.getByPlaceholder('请输入手机号')` | 输入提示 |
| 6 (最低) | CSS 选择器 | `page.locator('.btn-primary')` | 仅做兜底，不绑定具体 UI 框架 |

**强制规则**:
- MUST 优先使用 `data-testid`，前端组件必须预埋
- MUST NOT 使用 `.ant-btn-primary > span:nth-child(2)` 等脆弱选择器
- MUST NOT 使用 XPath（可读性差且维护成本高）
- 复合定位时链式调用：`page.locator('[data-testid="form"]').getByRole('button', { name: '提交' })`

---

## 2. 等待策略 (waitFor)

> **核心原则**：永远不要 `waitForTimeout()`。等待具体的网络事件、DOM 状态或条件。

| 场景 | 正确做法 | 错误做法 |
|------|---------|---------|
| 等待 API 响应 | `waitForResponse(url => url.includes('/api/xxx'))` | `waitForTimeout(2000)` |
| 等待元素可见 | `waitForSelector('[data-testid="result"]', { state: 'visible' })` | `waitForTimeout(1000)` |
| 等待页面加载 | `waitForLoadState('networkidle')` | `waitForTimeout(3000)` |
| 等待导航完成 | `waitForURL(/dashboard/)` | `waitForTimeout(2000)` |
| 等待动画结束 | `waitForLoadState('domcontentloaded')` + 元素断言 | `waitForTimeout(500)` |

### 等待 API 响应的标准模式

```typescript
// 触发操作并同时等待 API 完成
const [response] = await Promise.all([
  page.waitForResponse(resp =>
    resp.url().includes('/api/opportunities') &&
    resp.request().method() === 'POST' &&
    resp.status() === 200
  ),
  page.click('[data-testid="btn-submit"]'),
]);

// 验证响应体（可选）
const body = await response.json();
expect(body.data.id).toBeDefined();
```

### 轮询等待（仅用于异步任务）

```typescript
// 等待后台任务完成（如文件导入、批量处理）
await expect(async () => {
  await page.reload();
  const status = page.locator('[data-testid="task-status"]');
  await expect(status).toHaveText('已完成');
}).toPass({ timeout: 30_000 }); // 最多轮询 30 秒
```

---

## 3. 网络拦截与 Mock (page.route)

> **用途**：模拟后端异常、慢响应、特定数据场景，不依赖真实 API。

### 模拟 API 错误

```typescript
// 模拟 500 服务器错误
await page.route('**/api/opportunities', route => {
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '服务器异常' } }),
  });
});

await page.goto('/opportunities');
await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
```

### 模拟慢响应（测试 Loading 状态）

```typescript
await page.route('**/api/opportunities', async route => {
  await new Promise(resolve => setTimeout(resolve, 3000)); // 延迟 3 秒
  route.continue();
});

await page.goto('/opportunities');
// 此时 loading 骨架屏应该可见
await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
```

### 修改 API 响应数据

```typescript
await page.route('**/api/opportunities/*', async route => {
  const response = await route.fetch();
  const json = await response.json();
  // 注入特殊数据用于测试
  json.data.status = 'pending_review';
  route.fulfill({ response, json });
});
```

### 拦截规则

- MUST 用 `**` 通配符匹配 API 路径（不硬编码域名）
- MUST 在 `page.goto()` 之前设置 route 拦截
- MUST 在测试结束后取消拦截（`page.unroute()` 或在 test fixture 中自动清理）
- MUST NOT 拦截所有请求 — 只拦截测试需要的特定路径

---

## 4. 认证状态复用 (storageState)

> **原则**：登录一次，所有测试复用。详细配置见 `kf-mvp-playwright-infra`。

```typescript
// 在 fixture 中使用预保存的认证状态
import { test as base } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: './e2e/.auth/storage-state.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
```

**多角色场景**：为每个角色维护独立的 storageState 文件：

```
e2e/.auth/
├── admin-state.json      # 管理员
├── sales-state.json      # 销售人员
└── channel-state.json    # 渠道人员
```

---

## 5. API 路由拦截模式 (APIRequestContext)

> **用途**：在 Playwright E2E 测试中直接调用 API 做数据准备或验证，绕过 UI 操作。

```typescript
test('批量创建后可在列表中查到', async ({ page, request }) => {
  // 通过 API 直接创建测试数据（绕过表单 UI）
  const createResp = await request.post('/api/opportunities', {
    data: { name: '测试商机', amount: 50000, stage: 'initial' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(createResp.ok()).toBeTruthy();

  // 通过 UI 验证数据出现
  await page.goto('/opportunities');
  await expect(page.getByText('测试商机')).toBeVisible();
});
```

**适用场景**:
- 数据准备（beforeAll 中用 API 创建大量数据）
- 验证 UI 操作后的后端状态（API 查数据库确认）
- 绕过复杂的 UI 流程来测试下游功能

---

# 移动端 / H5 测试（v2.8 新增）

> **定位**：覆盖移动端特有场景 — 手势、WebView、弱网、离线。Desktop 视觉回归已由 v2.5 多分辨率矩阵覆盖，本节聚焦 **移动端独有能力**。

---

## 1. 移动端设备模拟

Playwright 内置设备描述符自动设置 viewport、userAgent、deviceScaleFactor、isMobile、hasTouch：

```typescript
// playwright.config.ts projects（已由 kf-mvp-playwright-infra 提供模板）
{
  name: 'mobile-chrome',
  use: { ...devices['Pixel 5'] },    // 393×851, Android
},
{
  name: 'mobile-safari',
  use: { ...devices['iPhone 13'] },   // 390×844, iOS
},
```

**强制规则**:
- 有移动端需求的页面 MUST 在至少一个移动设备 project 下测试
- MUST NOT 仅用 `page.setViewportSize()` 模拟移动端 — 它不设置 touch/userAgent

---

## 2. 手势模拟

### 滑动 (Swipe / Scroll)

```typescript
// 下拉刷新
const pullZone = page.locator('[data-testid="pull-to-refresh"]');
const box = await pullZone.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 10 });
  await page.mouse.up();
}
// 等待刷新完成
await page.waitForResponse(resp => resp.url().includes('/api/refresh'));
```

```typescript
// 左滑删除（列表项）
const item = page.locator('[data-testid="list-item-1"]');
const itemBox = await item.boundingBox();
if (itemBox) {
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(itemBox.x - 100, itemBox.y + itemBox.height / 2, { steps: 5 });
  await page.mouse.up();
}
await expect(page.locator('[data-testid="btn-delete"]')).toBeVisible();
```

### 捏合缩放 (Pinch)

```typescript
// Playwright 不直接支持多点触控，使用 CDP 协议
const client = await page.context().newCDPSession(page);

// 模拟 pinch-in（缩小）
await client.send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [
    { x: 200, y: 300 },
    { x: 300, y: 300 },
  ],
});
await client.send('Input.dispatchTouchEvent', {
  type: 'touchMove',
  touchPoints: [
    { x: 230, y: 300 },
    { x: 270, y: 300 },
  ],
});
await client.send('Input.dispatchTouchEvent', {
  type: 'touchEnd',
  touchPoints: [],
});
```

### 长按

```typescript
// 长按触发上下文菜单
await page.locator('[data-testid="message-item"]').click({
  button: 'left',
  delay: 1000, // 按住 1 秒 = 长按
});
await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
```

---

## 3. WebView 场景

> **场景**：H5 页面嵌入原生 App WebView，需要验证 H5 在受限环境中的表现。

### 模拟 WebView 环境

```typescript
test('H5 page works in WebView-like context', async ({ page }) => {
  // 模拟 WebView 的受限环境
  await page.context().addInitScript(() => {
    // 注入 WebView 标识（某些 H5 代码会检测此变量）
    (window as any).__IS_WEBVIEW__ = true;
    // 模拟 WebView 的 navigator 特征
    Object.defineProperty(navigator, 'standalone', { value: true });
  });

  await page.goto('/h5/product-detail?id=123');
  await page.waitForLoadState('networkidle');

  // 验证 H5 核心功能
  await expect(page.locator('[data-testid="product-info"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-add-cart"]')).toBeEnabled();
});
```

### JSBridge 模拟

```typescript
test('H5 calls native via JSBridge', async ({ page }) => {
  // 注入 mock JSBridge
  await page.context().addInitScript(() => {
    (window as any).NativeBridge = {
      call: (method: string, params: any) => {
        console.log(`[JSBridge] ${method}`, params);
        // 返回模拟的原生响应
        if (method === 'getDeviceInfo') {
          return JSON.stringify({ platform: 'android', version: '12' });
        }
        if (method === 'scanQRCode') {
          return JSON.stringify({ code: 'MOCK-QR-12345' });
        }
      },
    };
  });

  await page.goto('/h5/scan');
  await page.click('[data-testid="btn-scan"]');

  // 验证 H5 正确处理了 JSBridge 返回
  await expect(page.locator('[data-testid="scan-result"]')).toContainText('MOCK-QR-12345');
});
```

---

## 4. 离线 / 弱网模拟

### 弱网模拟 (Slow 3G / 4G)

```typescript
// 模拟 Slow 3G
test('page loads gracefully on slow network', async ({ page }) => {
  const context = page.context();
  const cdpSession = await context.newCDPSession(page);

  await cdpSession.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,          // 400ms RTT (Slow 3G)
    downloadThroughput: 500 * 1024 / 8,  // 500 Kbps
    uploadThroughput: 500 * 1024 / 8,    // 500 Kbps
  });

  await page.goto('/dashboard');

  // 弱网下：骨架屏 / loading 必须先出现
  await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();

  // 最终数据仍然加载成功
  await expect(page.locator('[data-testid="dashboard-data"]')).toBeVisible({
    timeout: 15_000, // 弱网下给更多时间
  });
});
```

### 完全离线

```typescript
test('offline mode shows cached data or friendly error', async ({ page }) => {
  const context = page.context();
  const cdpSession = await context.newCDPSession(page);

  // 先正常加载
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // 切换为离线
  await cdpSession.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  // 刷新页面
  await page.reload();

  // 应该看到离线提示而不是白屏
  const offlineNotice = page.locator('[data-testid="offline-notice"]');
  const cachedContent = page.locator('[data-testid="cached-dashboard"]');

  const hasOffline = await offlineNotice.isVisible().catch(() => false);
  const hasCache = await cachedContent.isVisible().catch(() => false);
  expect(hasOffline || hasCache).toBeTruthy();
});
```

### 请求失败模拟

```typescript
// 模拟特定 API 失败
await page.route('**/api/dashboard/stats', route => {
  route.abort('failed');  // 网络层失败
});

await page.goto('/dashboard');
// 验证错误降级：其他模块正常显示，仅统计卡片显示重试按钮
await expect(page.locator('[data-testid="stat-card-retry"]')).toBeVisible();
await expect(page.locator('[data-testid="recent-list"]')).toBeVisible(); // 其他数据正常
```

---

## 5. 移动端测试检查清单

- [ ] 所有 H5 页面在 Mobile project 下可正常打开
- [ ] 触摸操作（tap、swipe、long-press）正确响应
- [ ] 虚拟键盘弹出时表单不被遮挡
- [ ] 横竖屏切换不丢失数据（如有旋转需求）
- [ ] 弱网下 loading 骨架屏正确显示
- [ ] 离线模式有降级方案（缓存或友好提示）
- [ ] WebView JSBridge 调用正确（如有嵌入场景）
- [ ] 底部安全区（safe-area-inset）正确留白

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
- [ ] **Real 模式核心链路通过（v2.13）**：见下方「双模式运行」章节

---

# 双模式运行（v2.13 强制 — Mock + Real）

> **背景血案**：E2E 92/92 全绿，但全部跑在内存 Mock 服务器上；人工启动真实 SQLite 后端后，快捷登录立即报密码错误。测试环境与验收环境不是同一套后端，是测试全绿但一跑就挂的万恶之源。

## 两种模式定义

| 模式 | 后端 | 用途 | 命令 |
|------|------|------|------|
| **Mock 模式** | 内存 Mock 服务器 | 开发阶段快速反馈、CI 预检 | `bunx playwright test` |
| **Real 模式** | 真实后端（SQLite + bcrypt + JWT） | Stage4 人工验收前的最终验证（强制门禁） | `E2E_MODE=real bunx playwright test --config tests/e2e/playwright.real.config.ts` |

## Real 模式实现要点

1. **独立配置文件**：新增 `tests/e2e/playwright.real.config.ts`，webServer 启动真实后端（如 `bun run dev`）而非 mock-launcher
2. **global-setup 改造**：Real 模式下调用 seed API 或 `db:seed` 脚本初始化数据，**严禁直写 Mock 内存**
3. **用例可精简**：Real 模式不追求全量，最低覆盖：每角色登录成功（使用与登录页快捷按钮同款凭证）、禁用账号登录被拒、核心 CRUD 主链路（如：管理员审核+销售跟进+渠道报备）
4. **种子一致性前提**：Real 模式依赖「种子数据单一真源」铁律（seeds/ 目录被 Mock 和真实 DB 同时引用），否则两模式凭证不同必然失败
5. **端口从 .env 读取**：两套配置的 baseURL/webServer 端口均从 `.env` 读取，禁止硬编码

## API 路径唯一真源约束（v2.13）

- 前端 service 层（services/*.ts）请求路径 MUST 从 `api-contract.yaml` 提取，**严禁按 Mock 服务器路径约定编写**
- Mock 服务器路由 MUST 与 api-contract.yaml 逐条一致（路径、方法、参数位置）
- Real 模式 E2E 天然能暴露路径不一致：Mock 全绿但 Real 模式全部 404 → 立即检查 services/ 是否按 Mock 约定写死路径

## 门禁规则

Mock 模式全量通过 + Real 模式核心链路通过 → Stage4 可以标记完成；任一模式失败 → 门禁不通过，修复后两模式均重跑。

---

# UI 数据加载验证（v2.14 强制 — @headed 必测）

> **背景血案**：fetchChannelOptions() 调用不存在的 `/channels/options` 端点，所有后端路由表（Mock + 真实）均无此路径。API 层测试全部通过（因为没有对应的 contract 条目，contract-drift-log 只看已有条目是否变更），人工启动浏览器点击"创建客户"弹窗才看到渠道下拉为空。**API 测试通过 ≠ UI 数据加载通过。**

## @headed 用例清单新增项

在现有 @headed tag 用例清单中新增：

- [ ] **弹窗下拉/选择器选项渲染验证**：打开每个创建/编辑弹窗 → 逐一展开所有下拉框（Select/Dropdown/Combobox）→ 截图验证每个下拉至少出现 1 个选项（非空）。至少覆盖 1 个核心业务模块的完整弹窗。

## UI 数据加载验证模板

```typescript
// tests/e2e/ui-data-loading.spec.ts
import { test, expect } from '@playwright/test';

// 标记：此文件所有用例均为 @headed（必须真实浏览器渲染）
test.describe('UI 数据加载验证（v2.14）', () => {

  test('打开创建弹窗 → 验证下拉/选择器出现选项', async ({ page }) => {
    // Step 1: 登录 + 导航到目标页面
    // Step 2: 点击"新建/创建"按钮打开弹窗
    // Step 3: 展开每个下拉框，验证选项数量 ≥ 1
    const dropdown = page.locator('[data-testid="channel-select"]');
    await dropdown.click();
    const options = dropdown.locator('option, [role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5000 });
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);
    // Step 4: 截图留证
    await page.screenshot({ path: 'e2e-screenshots/ui-data-loading-channel-options.png' });
  });

});
```

## 检测清单（Stage3 前端开发完成后、Stage4 联调前）

- [ ] 每个核心业务模块的创建/编辑弹窗至少 1 条 @headed 下拉选项验证用例
- [ ] 验证范围覆盖：下拉选择器（Select）、级联选择器（Cascader）、自动补全（Autocomplete）、表格行数据渲染
- [ ] 所有 @headed 数据加载用例在 Real 模式下通过（Mock 全绿但 Real 空白 = 端点不存在）

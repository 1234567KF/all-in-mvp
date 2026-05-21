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

# Test Naming & Organization Standards (MUST — 迭代19核心修复)

**问题**：测试用例命名混乱、组织无序，导致测试难以维护、失败时难以定位。

**解决方案**：MUST 遵循 **统一命名规范** 和 **文件组织标准**。

## 测试文件组织

```
tests/
├── unit/                          # L1: 单元测试
│   ├── modules/
│   │   ├── user/
│   │   │   ├── user.service.test.ts      # 服务函数
│   │   │   ├── user.validator.test.ts    # 验证器
│   │   │   └── user.state-machine.test.ts # 状态机
│   │   └── product/
│   │       └── product.service.test.ts
│   └── utils/
│       └── date-helper.test.ts
├── integration/                   # L2-L3: 集成测试
│   ├── api/
│   │   ├── user.api.test.ts       # API路由测试
│   │   └── product.api.test.ts
│   ├── db/
│   │   ├── transaction.test.ts    # 数据库事务
│   │   └── migration.test.ts      # 迁移测试
│   └── contract/
│       └── mock-consistency.test.ts
├── e2e/                           # L4-L5: E2E测试
│   ├── scenarios/
│   │   ├── checkout-flow.spec.ts
│   │   └── auth-flow.spec.ts
│   └── pages/
│       └── login.spec.ts
├── security/                      # 安全测试
│   ├── injection.test.ts
│   └── rate-limit.test.ts
├── performance/                   # 性能测试
│   └── load.test.ts
└── factories/                     # 测试工厂
    └── TestFactory.ts
```

## 测试命名规范

### 文件命名

| 测试类型 | 命名模式 | 示例 |
|---------|---------|------|
| 单元测试 | `[unit].test.ts` | `user.service.test.ts` |
| 集成测试 | `[scope].[type].test.ts` | `user.api.test.ts` |
| E2E测试 | `[flow].spec.ts` | `checkout-flow.spec.ts` |
| 安全测试 | `[attack].test.ts` | `sql-injection.test.ts` |
| 性能测试 | `[metric].test.ts` | `api-load.test.ts` |

### 用例命名（迭代19标准化）

```typescript
// ✅ 正确：描述性行为 + 条件 + 结果
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid email and password', async () => {
      // ...
    });

    it('should reject creation when email already exists', async () => {
      // ...
    });

    it('should hash password before storing', async () => {
      // ...
    });
  });
});

// ✅ 正确：API测试用describe分组
describe('POST /api/users', () => {
  describe('201 Created', () => {
    it('should return user object with id when input is valid', async () => {});
  });

  describe('400 Bad Request', () => {
    it('should return VALIDATION_ERROR when email is malformed', async () => {});
    it('should return VALIDATION_ERROR when password is too short', async () => {});
  });

  describe('409 Conflict', () => {
    it('should return ALREADY_EXISTS when email is duplicate', async () => {});
  });
});

// ❌ 错误：命名不清晰
describe('user', () => {
  it('test1', () => {});      // 无意义
  it('should work', () => {}); // 太模糊
  it('error', () => {});       // 不完整
});
```

### 命名检查清单

- [ ] 每个 `it` 描述以 "should" 开头
- [ ] 描述包含：行为 + 条件（when/if/with）
- [ ] `describe` 按功能/状态码分组
- [ ] 避免无意义的编号（test1, test2）
- [ ] 避免过于笼统的描述（"should work"）

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

## Factories (MUST — 迭代15标准化)

**问题**：各模块测试数据分散、重复，不同测试用hardcoded ID导致冲突，数据工厂不统一导致测试不稳定。

**解决方案**：MUST 使用 **统一TestFactory**，所有测试数据通过工厂创建，确保隔离性和一致性。

### 统一TestFactory模板

```typescript
// tests/factories/TestFactory.ts
import { faker } from '@faker-js/faker';
import { Hono } from 'hono';
import { getTestDb } from '../helpers';

export class TestFactory {
  private app: Hono;
  private db: ReturnType<typeof getTestDb>;
  private idCounter = 0;

  constructor() {
    this.db = getTestDb();
    this.app = new Hono();
    // 注册测试路由
  }

  // 生成唯一ID（避免hardcoded冲突）
  private nextId(): number {
    return ++this.idCounter;
  }

  // 用户工厂
  async createUser(overrides: Partial<User> = {}): Promise<User> {
    const user = {
      id: this.nextId(),
      email: overrides.email || faker.internet.email(),
      name: overrides.name || faker.person.fullName(),
      role: overrides.role || 'user',
      passwordHash: await hashPassword(overrides.password || 'Password123!'),
      createdAt: new Date().toISOString(),
      ...overrides,
    };
    await this.db.insert(users).values(user);
    return user;
  }

  // 产品工厂
  async createProduct(overrides: Partial<Product> = {}): Promise<Product> {
    const product = {
      id: this.nextId(),
      name: overrides.name || faker.commerce.productName(),
      price: overrides.price || faker.number.int({ min: 1, max: 10000 }),
      stock: overrides.stock ?? faker.number.int({ min: 0, max: 1000 }),
      categoryId: overrides.categoryId,
      ...overrides,
    };
    await this.db.insert(products).values(product);
    return product;
  }

  // 订单工厂（自动创建关联数据）
  async createOrder(overrides: Partial<Order> & { items?: OrderItemInput[] } = {}): Promise<Order> {
    const userId = overrides.userId || (await this.createUser()).id;
    
    const order = {
      id: this.nextId(),
      userId,
      status: overrides.status || 'PENDING',
      total: overrides.total || 0,
      ...overrides,
    };
    
    await this.db.insert(orders).values(order);

    // 自动创建订单项
    if (overrides.items) {
      let total = 0;
      for (const item of overrides.items) {
        const product = item.productId 
          ? await this.db.select().from(products).where(eq(products.id, item.productId)).limit(1)
          : [await this.createProduct()];
        
        const price = product[0].price;
        await this.db.insert(orderItems).values({
          orderId: order.id,
          productId: product[0].id,
          quantity: item.quantity,
          price,
        });
        total += price * item.quantity;
      }
      
      // 更新订单总价
      await this.db.update(orders)
        .set({ total })
        .where(eq(orders.id, order.id));
      order.total = total;
    }

    return order;
  }

  // 溯源码工厂
  async createTraceCode(overrides: Partial<TraceCode> = {}): Promise<TraceCode> {
    const productId = overrides.productId || (await this.createProduct()).id;
    
    const traceCode = {
      id: this.nextId(),
      code: overrides.code || faker.string.alphanumeric(16).toUpperCase(),
      productId,
      status: overrides.status || 'ACTIVE',
      ...overrides,
    };
    
    await this.db.insert(traceCodes).values(traceCode);
    return traceCode;
  }

  // 生成JWT token
  async getToken(user: User): Promise<string> {
    return createToken(user);
  }

  // 清理所有数据
  async cleanup(): Promise<void> {
    // 按依赖顺序清理（先子表后父表）
    await this.db.delete(orderItems);
    await this.db.delete(orders);
    await this.db.delete(traceCodes);
    await this.db.delete(products);
    await this.db.delete(users);
    this.idCounter = 0;
  }
}
```

### Factory使用规范

```typescript
// ✅ 正确：使用Factory创建数据
describe('Order Module', () => {
  const factory = new TestFactory();

  afterEach(async () => {
    await factory.cleanup(); // 每个测试后清理
  });

  it('should create order with items', async () => {
    const order = await factory.createOrder({
      items: [
        { productId: (await factory.createProduct({ price: 100 })).id, quantity: 2 },
        { productId: (await factory.createProduct({ price: 50 })).id, quantity: 1 },
      ]
    });
    
    expect(order.total).toBe(250); // 100*2 + 50*1
  });
});

// ❌ 错误：hardcoded ID
describe('Order Module', () => {
  it('should create order', async () => {
    const order = await createOrder({ userId: 1 }); // 可能与其他测试冲突！
  });
});
```

### 工厂设计原则

| 原则 | 说明 |
|------|------|
| 自增ID | 使用内部计数器，避免hardcoded ID冲突 |
| 自动关联 | 创建子实体时自动创建父实体（除非指定） |
| 默认值合理 | 所有字段有有意义的默认值，减少overrides |
| 可清理 | 提供cleanup方法，确保测试隔离 |
| 类型安全 | 所有工厂方法返回正确类型 |

### 场景级测试数据工厂（③b-2 E2E用）

跨模块场景测试需要连贯的数据链。场景工厂提供"一键创建完整故事"的能力：

```typescript
// tests/factories/ScenarioFactory.ts
// 继承 TestFactory，提供场景级快捷方法

export class ScenarioFactory extends TestFactory {
  // 场景1：完整的"品牌商创建营销活动→消费者扫码"故事线
  async createMarketingToTraceScenario() {
    // 创建品牌商用户
    const brandUser = await this.createUser({ role: 'brand', name: '品牌商张三' });
    const brandToken = await this.getToken(brandUser);

    // 创建产品
    const product = await this.createProduct({ name: '有机大米5kg', price: 89 });

    // 创建营销活动
    const campaign = await this.createCampaign({
      name: '618大促',
      productId: product.id,
      createdBy: brandUser.id,
    });

    // 为产品生成溯源码段
    const traceBatch = await this.createTraceBatch({
      productId: product.id,
      count: 100,
      prefix: 'KF',
    });

    // 创建消费者用户
    const consumerUser = await this.createUser({ role: 'user', name: '消费者李四' });
    const consumerToken = await this.getToken(consumerUser);

    return {
      brandUser, brandToken,
      product,
      campaign,
      traceBatch,
      consumerUser, consumerToken,
    };
  }

  // 场景2：完整的"用户注册→下单→支付→发货"故事线
  async createOrderFlowScenario() {
    const user = await this.createUser();
    const token = await this.getToken(user);
    const product = await this.createProduct({ price: 100, stock: 50 });
    
    const order = await this.createOrder({
      userId: user.id,
      status: 'PENDING',
      items: [{ productId: product.id, quantity: 2 }],
    });

    return { user, token, product, order };
  }
}
```

### 边界值测试辅助工具

```typescript
// tests/helpers/BoundaryHelper.ts
export const BoundaryHelper = {
  // 生成边界值测试数据
  strings: {
    empty: '',
    singleChar: 'x',
    maxLength: (field: string, max: number) => 'x'.repeat(max),
    overMax: (field: string, max: number) => 'x'.repeat(max + 1),
    special: '<script>alert(1)</script>',
    sqlInjection: "'; DROP TABLE users; --",
    unicode: '🙂🎉中文日本語',
    zeroWidth: '\u200B\u200C\u200D',
  },
  numbers: {
    zero: 0,
    negative: -1,
    maxInt: 2147483647,
    overMaxInt: 2147483648,
    float: 3.14159,
    NaN: Number.NaN,
    infinity: Number.POSITIVE_INFINITY,
  },
  arrays: {
    empty: [],
    single: [1],
    large: Array.from({ length: 10000 }, (_, i) => i),
  },
  dates: {
    past: '1970-01-01',
    future: '2099-12-31',
    invalid: 'not-a-date',
  },
};
```

## Factories (基础版)
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

# Test Reporting & Coverage (MUST — 迭代16核心修复)

**问题**：测试结果和覆盖率报告分散，难以追踪趋势，CI失败时难以定位问题。

**解决方案**：MUST 配置 **统一测试报告** 和 **覆盖率可视化**。

## 测试报告配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    reporters: ['default', 'junit', 'html'],
    outputFile: {
      junit: './test-results/junit.xml',
      html: './test-results/report.html',
    },
  },
});
```

## 覆盖率报告解读

```bash
# 生成覆盖率报告
npx vitest run --coverage

# 输出示例：
# --------------- Coverage ---------------
# File           | Statements | Branches | Functions | Lines
# ---------------|------------|----------|-----------|-------
# src/modules/   | 85.2%      | 78.5%    | 82.1%     | 84.9%
# src/utils/     | 92.1%      | 88.3%    | 90.5%     | 91.7%
# ---------------|------------|----------|-----------|-------
# ALL            | 87.5%      | 81.2%    | 85.3%     | 86.8%
```

## CI集成报告

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npx vitest run --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results/
```

# CI/CD Pipeline Testing (MUST — 迭代17核心修复)

**问题**：测试只在本地运行，CI环境配置不同导致测试失败，部署前未验证。

**解决方案**：MUST 配置 **CI流水线测试**，确保每次提交都自动运行测试。

## GitHub Actions配置

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run L1-L3 tests (headless)
        run: npx vitest run
      
      - name: Run L5 tests (Playwright headless)
        run: npx playwright test --project=chromium-headless
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install chromium
      
      - name: Run L5 E2E tests
        run: npx playwright test --project=chromium-headless
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 流水线测试阶段

| 阶段 | 触发条件 | 测试内容 | 时间目标 |
|------|---------|---------|---------|
| Pre-commit | git commit | L1单元测试 + lint | < 30s |
| PR | pull request | L1-L3全部 | < 5min |
| Merge | merge to main | L1-L5全部 | < 15min |
| Nightly | 每天凌晨 | L1-L5 + 性能测试 | < 1h |

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
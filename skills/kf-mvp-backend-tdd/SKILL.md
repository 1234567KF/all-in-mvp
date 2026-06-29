---
name: kf-mvp-backend-tdd
description: >-
  Load when user asks to develop backend using TDD, implement module with
  test-first, or run red-green-refactor cycle. Triggers: TDD, 后端开�?
  红绿重构, 写测�? 测试驱动, backend, module implementation,
  RED GREEN REFACTOR. NOT for: frontend development, database schema design,
  or API contract design.
metadata:
  pattern: pipeline
  domain: mvp-stage3
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: kf-mvp-biz-expert
      type: sequential
    - target: kf-mvp-code-review
      type: conditional
    - target: all-in-mvp
      type: semantic
---

# MVP Backend TDD Developer �?后端TDD开发技�?

> **Core Belief**: Tests are not after-thoughts. They define the contract before implementation. Red first, green second, refactor always.

**Division of Labor**: This Skill focuses on **module implementation** using strict TDD cycle. It outputs working code + passing tests. Follows Pipeline pattern with mandatory phase gates.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Runtime: Node.js >= 18
- Framework: Hono 4.x
- Database: SQLite (better-sqlite3)
- ORM: Drizzle ORM
- Auth: JWT (jsonwebtoken)
- Validation: Zod
- Testing: Vitest

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Red first** �?Write a failing test before any implementation
2. **Green second** �?Write minimum code to make test pass
3. **Refactor always** �?Clean up code while tests stay green
4. **Code review on failure** �?Green phase failure triggers review
5. **Default stack enforced** �?Use Hono + Drizzle + SQLite unless user explicitly requests otherwise

---

# TDD Cycle

```
┌─ TDD Cycle ──────────────────────────────────�?
�?                                             �?
�? 1. RED: Write failing test                  �?
�?    �?Test should fail with current code     �?
�?                                             �?
�? 2. GREEN: Write minimal implementation      �?
�?    �?Make test pass, no more                �?
�?    �?IF test still fails �?Trigger Review   �?
�?                                             �?
�? 3. REFACTOR: Clean up code                  �?
�?    �?IF tests fail �?Rollback or fix        �?
�?    �?IF ok �?Continue                       �?
�?                                             �?
�? 4. REPEAT until feature complete            �?
�?                                             �?
└──────────────────────────────────────────────�?
```

---

# Code Review Triggers

## CR 触发条件（按 TDD 阶段�?

| TDD 阶段 | 触发条件 | CR 行为 |
|---------|---------|--------|
| RED | 测试无法编写（契约不清晰�?| 审查模块定义�?API 契约 |
| GREEN | 3 次尝试后测试仍失�?| 强制触发 CR；审查实现逻辑 |
| REFACTOR | 重构导致已通过的测试失�?| 审查重构变更范围 |
| DONE �?| 所有测试通过后、写 DONE 标记�?| **终审**：强制触�?CR |

## 打回上限

| 阶段 | 最大轮�?| 超限处理 |
|------|---------|---------|
| TDD 循环（RED→GREEN→REFACTOR�?| 5 �?| 标记 BLOCKED �?人类介入 |
| Code Review | 3 轮打�?| 标记 BLOCKED �?人类介入 |

> **5 �?TDD 仍无法通过** �?可能模块定义有缺陷，回退�?Stage2 重新审查 `<module>.md`
> **3 �?CR 打回仍不通过** �?可能技术方案不匹配，人类决�?

## 开发失败处�?

```
TDD 5轮未通过
  �?
写入 BLOCKED 标记 + reason.md
  �?
Coordinator 检测到 BLOCKED
  �?
评估是否需要回退�?Stage2 修正模块定义
  �?
人类决策：继�?/ 回退 / 重分�?
```

---

# Module File Structure

```
src/
└── modules/
    └── <module>/
        ├── routes.ts      # Route definitions
        ├── service.ts     # Business logic
        ├── schema.ts      # Table definitions (reference global schema)
        ├── types.ts       # DTO / types
        └── <module>.test.ts  # Unit tests
```

---

# Stage 1: Read Inputs

**Confirm prerequisites**:
- [ ] PRD file is available
- [ ] spec.md + schema.sql + api-contract.yaml is LOCKED
- [ ] `<module>.md` is available with acceptance criteria
- [ ] Integration test template: `integration-tests/modules/<module>.test.ts`

**IF inputs not ready**: Report BLOCKED, DO NOT start

---

# Stage 2: Analyze Module Spec

**Read module spec** (`<module>.md`):
1. Understand module responsibility boundary
2. Identify all interfaces to implement
3. List all acceptance criteria
4. Note dependencies

**Output understanding**:
```markdown
## 模块理解

**模块�?*: [module]
**职责**: [responsibility]

**接口清单**:
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/[module] | ... |
| POST | /api/[module] | ... |

**验收标准**:
- [ ] [标准1]
- [ ] [标准2]

**依赖模块**: [list]
```

---

# Stage 3: RED Phase �?Write Failing Test

## Test Location

**Unit tests**: `src/modules/<module>/<module>.test.ts`
**Integration tests**: `integration-tests/modules/<module>.test.ts`

## Test Coverage Requirements (MUST �?人工测试发现漏测的核心问�?

每个模块的测�?MUST 覆盖以下 5 层：

| 层级 | 类型 | 工具 | 覆盖目标 | 运行模式 |
|------|------|------|---------|---------|
| L1 | 单元测试 | Vitest | Service函数、纯函数、工具函�?| 无头 (headless) |
| L2 | API集成测试 | Vitest + Hono app.request() | 每个路由�?happy + 所�?error path | 无头 (headless) |
| L3 | 数据库集成测�?| Vitest + SQLite in-memory | Drizzle ORM 操作、事务、迁�?| 无头 (headless) |
| L4 | 有头浏览器测�?| Playwright (headed) | 真实浏览器渲染、交互、CSS | 有头 (headed) |
| L5 | 无头CI测试 | Playwright (headless) | CI流水线快速验证、截图对�?| 无头 (headless) |

**关键修复**：之前人工测试发现错误，根本原因是只�?L1-L2，缺�?L3-L5。尤其是�?
- 数据库事务回滚未测试 �?L3 强制要求
- 前端交互在真实浏览器中失�?�?L4 强制要求
- CI中测试通过但人工测试失�?�?L5 �?L4 必须同时存在

## Test Structure (Vitest + Hono Test Adapter + Playwright)

### L1-L3: 后端测试 (Vitest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { moduleRoutes } from './routes';
import { getTestDb, seedTestData } from '@/tests/helpers';

describe('[Module] API �?L2 Integration', () => {
  let app: Hono;
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb(); // SQLite in-memory for each test
    app = new Hono();
    app.route('/api/[module]', moduleRoutes);
    seedTestData(db);
  });

  describe('GET /api/[module]', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await app.request('/api/[module]');
      expect(res.status).toBe(401);
    });

    it('should return list when authenticated', async () => {
      const token = await getTestToken();
      const res = await app.request('/api/[module]', {
        headers: { Authorization: `Bearer ${token}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    // MUST: 边界条件测试（之前漏测的核心问题�?
    it('should handle empty list gracefully', async () => {
      await db.delete(modules); // 清空数据
      const token = await getTestToken();
      const res = await app.request('/api/[module]', {
        headers: { Authorization: `Bearer ${token}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toEqual([]); // MUST 返回空数组，不是 null/undefined
    });
  });

  describe('POST /api/[module]', () => {
    it('should create resource with valid input', async () => {
      // Implementation
    });

    it('should return 400 with invalid input', async () => {
      // Implementation
    });

    // MUST: 所�?Zod 校验规则�?error path
    it('should return 400 when required field missing', async () => {
      const token = await getTestToken();
      const res = await app.request('/api/[module]', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // 空body测试
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });
});

// L3: 数据库事务测�?
describe('[Module] DB �?L3 Transaction', () => {
  it('should rollback on error', async () => {
    const db = getTestDb();
    const initialCount = await db.select({ count: count() }).from(modules);
    
    try {
      await db.transaction(async (tx) => {
        await tx.insert(modules).values({ name: 'test' });
        throw new Error('Simulated error');
      });
    } catch (e) {
      // expected
    }
    
    const finalCount = await db.select({ count: count() }).from(modules);
    expect(finalCount[0].count).toBe(initialCount[0].count); // MUST 回滚
  });
});
```

### L4-L5: Playwright 配置 (有头/无头)

```typescript
// playwright.config.ts �?MUST 区分有头和无头配�?
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  // L5: CI 无头模式
  projects: [
    {
      name: 'chromium-headless',
      use: { 
        ...devices['Desktop Chrome'],
        headless: true, // CI 无头
      },
    },
    // L4: 本地有头模式（人工验证）
    {
      name: 'chromium-headed',
      use: { 
        ...devices['Desktop Chrome'],
        headless: false, // 本地有头，可见浏览器
        launchOptions: { slowMo: 100 }, // 慢速便于观�?
      },
      // 只在本地运行，CI 跳过
      grepInvert: process.env.CI ? /.*/ : null,
    },
  ],
  
  // 本地开发服务器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### L4: 有头浏览器测试示�?

```typescript
// e2e/module.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Module E2E �?L4 Headed', () => {
  test('should display list and handle empty state', async ({ page }) => {
    await page.goto('/modules');
    
    // 等待加载完成（不是简�?timeout�?
    await page.waitForResponse(resp => resp.url().includes('/api/modules'));
    
    // 验证空状�?UI（之前漏测：空数据时前端崩溃�?
    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    
    // 截图对比（有头模式下人工可查看）
    await page.screenshot({ path: 'test-results/empty-state.png' });
  });

  test('should create item and show in list', async ({ page }) => {
    await page.goto('/modules');
    
    // 点击新增按钮
    await page.click('[data-testid="btn-create"]');
    
    // 填写表单
    await page.fill('[data-testid="input-name"]', 'Test Item');
    await page.click('[data-testid="btn-submit"]');
    
    // 等待请求完成
    await page.waitForResponse(resp => 
      resp.url().includes('/api/modules') && resp.request().method() === 'POST'
    );
    
    // 验证列表中出现新项目（真实浏览器渲染�?
    const newItem = page.locator('text=Test Item');
    await expect(newItem).toBeVisible();
  });
});
```

**Tech Stack Note**: Uses Vitest (not Jest) + Hono's built-in `app.request()` for integration testing. SQLite in-memory database per test via `better-sqlite3`.

## RED Phase Rules

1. **Write test for happy path first**
2. **Run test �?MUST fail** (otherwise test is not testing anything)
3. **Test must fail with meaningful error** (not syntax error)
4. **Do NOT write implementation** yet

**Output RED phase**:
```markdown
## RED Phase 状�?

**测试文件**: src/modules/<module>/<module>.test.ts
**测试用例�?*: [N]
**运行结果**: �?FAIL
  - [Test 1]: �?FAIL - [error message]
  - [Test 2]: �?FAIL - [error message]

**结论**: RED phase complete, proceed to GREEN
```

---

# Stage 4: GREEN Phase �?Minimal Implementation

## Implementation Rules

1. **Write minimum code to make tests pass**
2. **Do NOT optimize** (optimization comes in refactor phase)
3. **Do NOT add features** not covered by tests
4. **IF test still fails after reasonable effort �?Trigger Code Review**

## GREEN Phase 测试执行验证 (MUST �?防止"假绿")

之前人工测试发现错误的核心原因：测试"看起来通过�?，但实际�?bug�?*GREEN Phase 必须执行以下验证**�?

### 验证清单

```markdown
## GREEN Phase 验证

### L1-L3 后端测试
- [ ] 运行 `npx vitest run` �?全部通过
- [ ] 运行 `npx vitest run --coverage` �?覆盖�?�?80%
- [ ] 检�?coverage 报告 �?每个 error path 都被覆盖
- [ ] 故意注释掉一行实现代�?�?测试 MUST 失败（验证测试有效性）

### L4 有头浏览器测试（本地人工验证�?
- [ ] 运行 `npx playwright test --project=chromium-headed`
- [ ] 观察浏览器窗�?�?操作是否按预期执�?
- [ ] 检�?screenshots 目录 �?截图是否正确
- [ ] 人工肉眼检�?UI �?有无明显错误

### L5 无头CI测试
- [ ] 运行 `npx playwright test --project=chromium-headless`
- [ ] 对比 L4 �?L5 结果 �?必须一�?
- [ ] 如果 L4 通过�?L5 失败 �?检�?headless/headed 差异（常见：CSS �?headless 下渲染不同）

### 关键差异检�?
| 问题 | 原因 | 解决 |
|------|------|------|
| 有头通过，无头失�?| CSS �?headless 下渲染不�?| 使用 `page.waitForSelector` 而非固定 timeout |
| 无头通过，有头失�?| 真实浏览器有额外限制（CORS/CSP�?| 检查浏览器 console 错误 |
| 两者都通过，人工发�?bug | 测试断言不够严格 | 加强断言，检查具体值而非 just "not null" |
```

## Routes Implementation (Hono + Zod Validation)

```typescript
// src/modules/<module>/routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getModuleService } from './service';
import { createModuleSchema, updateModuleSchema } from './schema';
import type { CreateModuleDto, UpdateModuleDto } from './types';

export const moduleRoutes = new Hono()
  .get('/', async (c) => {
    const db = c.get('db');
    const service = getModuleService(db);
    const items = await service.findAll();
    return c.json({ success: true, data: items });
  })
  .get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const db = c.get('db');
    const service = getModuleService(db);
    const item = await service.findById(id);
    if (!item) return c.json({ success: false, error: 'Not found' }, 404);
    return c.json({ success: true, data: item });
  })
  .post('/', zValidator('json', createModuleSchema), async (c) => {
    const body = c.req.valid('json') as CreateModuleDto;
    const db = c.get('db');
    const service = getModuleService(db);
    const item = await service.create(body);
    return c.json({ success: true, data: item }, 201);
  })
  .put('/:id', zValidator('json', updateModuleSchema), async (c) => {
    const id = parseInt(c.req.param('id'));
    const body = c.req.valid('json') as UpdateModuleDto;
    const db = c.get('db');
    const service = getModuleService(db);
    const item = await service.update(id, body);
    return c.json({ success: true, data: item });
  })
  .delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const db = c.get('db');
    const service = getModuleService(db);
    await service.delete(id);
    return c.json({ success: true });
  });
```

## Service Implementation (Drizzle ORM + SQLite)

```typescript
// src/modules/<module>/service.ts
import { eq, isNull } from 'drizzle-orm';
import type { Database } from '@/db';
import { modules } from '@/db/schema';
import type { ModuleEntity, CreateModuleDto, UpdateModuleDto } from './types';

export interface ModuleService {
  create(data: CreateModuleDto): Promise<ModuleEntity>;
  findById(id: number): Promise<ModuleEntity | null>;
  findAll(): Promise<ModuleEntity[]>;
  update(id: number, data: UpdateModuleDto): Promise<ModuleEntity>;
  delete(id: number): Promise<void>;
}

export const getModuleService = (db: Database): ModuleService => ({
  async create(data) {
    const result = await db.insert(modules).values(data).returning();
    return result[0];
  },

  async findById(id) {
    const result = await db.select().from(modules)
      .where(eq(modules.id, id))
      .where(isNull(modules.deletedAt))
      .limit(1);
    return result[0] || null;
  },

  async findAll() {
    return db.select().from(modules)
      .where(isNull(modules.deletedAt))
      .orderBy(modules.createdAt);
  },

  async update(id, data) {
    const result = await db.update(modules)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(modules.id, id))
      .returning();
    return result[0];
  },

  async delete(id) {
    // Soft delete by default
    await db.update(modules)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(modules.id, id));
  },
});
```

**Tech Stack Note**: Uses Drizzle ORM with SQLite (`drizzle-orm/sqlite-core`). All queries MUST include `isNull(deletedAt)` for soft delete filtering.

## GREEN Phase Rules

1. **Test passes �?Move to REFACTOR**
2. **Test fails �?Analyze原因**
   - If implementation bug �?Fix implementation
   - If test wrong �?Fix test (but keep RED phase)
   - If requirement unclear �?Ask for clarification
3. **After 3 attempts �?Trigger Code Review**

---

# Stage 4.5: 状态流转测�?(MUST �?迭代3核心修复)

**问题**：工�?订单等系统有复杂状态机（待处理→处理中→已解决→已关闭），之前状态流转bug只在人工测试时发现�?

**解决方案**：有状态实�?MUST 编写 **状态机测试**，覆盖所有合法流�?+ 非法流转阻断�?

## 状态机测试模板

```typescript
// src/modules/ticket/ticket.state.test.ts
import { describe, it, expect } from 'vitest';
import { TicketStatus, TicketStatusMachine } from './state-machine';

describe('Ticket State Machine', () => {
  const machine = new TicketStatusMachine();

  // 合法流转测试
  describe('Valid Transitions', () => {
    it('PENDING �?IN_PROGRESS (admin assigns)', () => {
      const result = machine.canTransition('PENDING', 'IN_PROGRESS', { role: 'admin' });
      expect(result.allowed).toBe(true);
    });

    it('IN_PROGRESS �?RESOLVED (agent resolves)', () => {
      const result = machine.canTransition('IN_PROGRESS', 'RESOLVED', { role: 'agent' });
      expect(result.allowed).toBe(true);
    });

    it('RESOLVED �?CLOSED (user confirms or auto-close after 7 days)', () => {
      const result = machine.canTransition('RESOLVED', 'CLOSED', { role: 'user' });
      expect(result.allowed).toBe(true);
    });

    it('RESOLVED �?REOPENED (user rejects)', () => {
      const result = machine.canTransition('RESOLVED', 'REOPENED', { role: 'user' });
      expect(result.allowed).toBe(true);
    });

    it('REOPENED �?IN_PROGRESS (admin reassigns)', () => {
      const result = machine.canTransition('REOPENED', 'IN_PROGRESS', { role: 'admin' });
      expect(result.allowed).toBe(true);
    });
  });

  // 非法流转测试 �?MUST 阻断
  describe('Invalid Transitions (MUST be blocked)', () => {
    it('PENDING �?CLOSED (cannot skip)', () => {
      const result = machine.canTransition('PENDING', 'CLOSED', { role: 'admin' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot skip from PENDING to CLOSED');
    });

    it('CLOSED �?IN_PROGRESS (closed is final)', () => {
      const result = machine.canTransition('CLOSED', 'IN_PROGRESS', { role: 'admin' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CLOSED is a terminal state');
    });

    it('PENDING �?RESOLVED (user cannot resolve directly)', () => {
      const result = machine.canTransition('PENDING', 'RESOLVED', { role: 'user' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User cannot transition from PENDING to RESOLVED');
    });
  });

  // 权限测试
  describe('Role-based Permissions', () => {
    it('user cannot assign ticket', () => {
      const result = machine.canTransition('PENDING', 'IN_PROGRESS', { role: 'user' });
      expect(result.allowed).toBe(false);
    });

    it('agent cannot close without resolve', () => {
      const result = machine.canTransition('IN_PROGRESS', 'CLOSED', { role: 'agent' });
      expect(result.allowed).toBe(false);
    });
  });

  // 副作用测�?
  describe('Transition Side Effects', () => {
    it('should record timestamp on resolve', () => {
      const ticket = { status: 'IN_PROGRESS', createdAt: new Date() };
      const result = machine.transition(ticket, 'RESOLVED', { role: 'agent' });
      expect(result.ticket.resolvedAt).toBeInstanceOf(Date);
    });

    it('should increment reopen count', () => {
      const ticket = { status: 'RESOLVED', reopenCount: 0 };
      const result = machine.transition(ticket, 'REOPENED', { role: 'user' });
      expect(result.ticket.reopenCount).toBe(1);
    });
  });
});
```

## 状态机实现模板

```typescript
// src/modules/ticket/state-machine.ts
export type TicketStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED' | 'CLOSED';

interface TransitionContext {
  role: 'admin' | 'agent' | 'user';
}

interface TransitionResult {
  allowed: boolean;
  reason?: string;
  ticket?: any;
}

export class TicketStatusMachine {
  // 定义合法流转�?
  private transitions: Record<TicketStatus, Array<{ to: TicketStatus; roles: string[]; validate?: (ctx: TransitionContext) => boolean }>> = {
    PENDING: [
      { to: 'IN_PROGRESS', roles: ['admin'] },
    ],
    IN_PROGRESS: [
      { to: 'RESOLVED', roles: ['agent', 'admin'] },
    ],
    RESOLVED: [
      { to: 'CLOSED', roles: ['user', 'admin'] },
      { to: 'REOPENED', roles: ['user'] },
    ],
    REOPENED: [
      { to: 'IN_PROGRESS', roles: ['admin'] },
    ],
    CLOSED: [], // 终�?
  };

  canTransition(from: TicketStatus, to: TicketStatus, ctx: TransitionContext): TransitionResult {
    const validTransitions = this.transitions[from];
    
    if (!validTransitions) {
      return { allowed: false, reason: `Invalid from state: ${from}` };
    }

    const transition = validTransitions.find(t => t.to === to);
    
    if (!transition) {
      return { allowed: false, reason: `Cannot transition from ${from} to ${to}` };
    }

    if (!transition.roles.includes(ctx.role)) {
      return { allowed: false, reason: `Role ${ctx.role} cannot perform this transition` };
    }

    if (transition.validate && !transition.validate(ctx)) {
      return { allowed: false, reason: 'Additional validation failed' };
    }

    return { allowed: true };
  }

  transition(ticket: any, to: TicketStatus, ctx: TransitionContext): TransitionResult {
    const check = this.canTransition(ticket.status, to, ctx);
    if (!check.allowed) return check;

    const updated = { ...ticket, status: to };
    
    // 副作�?
    if (to === 'RESOLVED') updated.resolvedAt = new Date();
    if (to === 'REOPENED') updated.reopenCount = (ticket.reopenCount || 0) + 1;
    if (to === 'CLOSED') updated.closedAt = new Date();

    return { allowed: true, ticket: updated };
  }
}
```

## 状态流转测试覆盖率要求

| 测试类型 | 最低数�?| 说明 |
|---------|---------|------|
| 合法正向流转 | 所有边 | 状态图中每条边至少1个测�?|
| 非法流转阻断 | 所有缺失边 | 状态图中不存在的边 MUST 测试阻断 |
| 权限验证 | 每个流转 × 角色 | 不同角色对同一流转的结果可能不�?|
| 副作用验�?| 每个有副作用的流�?| timestamp、计数器、通知�?|
| 终态保�?| 每个终�?| 终�?MUST 不可再流�?|

---

# Stage 4.6: 并发与边界测�?(MUST �?迭代6核心修复)

**问题**：营销系统（优惠券、秒杀、抽奖）有大量并发场景，之前并发bug只在人工测试时发现（如：秒杀超卖、优惠券重复领取、库存负数）�?

**解决方案**：MUST 编写 **并发安全测试** �?**边界条件测试**，覆盖竞态条件、资源耗尽、极限值�?

## 并发安全测试模板

```typescript
// src/modules/coupon/coupon.concurrency.test.ts
import { describe, it, expect } from 'vitest';
import { getTestDb } from '@/tests/helpers';
import { getCouponService } from './service';

describe('Coupon Concurrency �?Marketing System', () => {
  it('should NOT allow duplicate claim under concurrent requests', async () => {
    const db = getTestDb();
    const service = getCouponService(db);
    
    // 创建限量优惠券：只有1�?
    const coupon = await service.create({ 
      code: 'FLASH50', 
      totalQuantity: 1,
      remaining: 1 
    });
    
    // 模拟10个用户同时领�?
    const users = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    const results = await Promise.allSettled(
      users.map(u => service.claim(coupon.id, u.id))
    );
    
    // MUST：只�?个成�?
    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBe(1);
    
    // MUST：剩余数量为0
    const updated = await service.findById(coupon.id);
    expect(updated.remaining).toBe(0);
  });

  it('should handle flash sale stock correctly', async () => {
    const db = getTestDb();
    const service = getProductService(db);
    
    // 创建秒杀商品：库�?
    const product = await service.create({ name: 'Flash Item', stock: 5 });
    
    // 20个用户同时下�?
    const orders = Array.from({ length: 20 }, (_, i) => ({
      userId: i + 1,
      productId: product.id,
      quantity: 1
    }));
    
    const results = await Promise.allSettled(
      orders.map(o => service.purchase(o.productId, o.userId, o.quantity))
    );
    
    // MUST：只�?个成功（库存限制�?
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);
    expect(successes.length).toBe(5);
    
    // MUST：库存为0
    const updated = await service.findById(product.id);
    expect(updated.stock).toBe(0);
    
    // MUST：其�?5个返回库存不�?
    const failures = results.filter(r => 
      r.status === 'rejected' || 
      (r.status === 'fulfilled' && !r.value.success)
    );
    expect(failures.length).toBe(15);
  });

  it('should prevent race condition in balance deduction', async () => {
    const db = getTestDb();
    const service = getWalletService(db);
    
    // 用户余额100
    const user = await service.createUser({ balance: 100 });
    
    // 同时发起3�?0元的扣款
    const deductions = Array.from({ length: 3 }, () => 
      service.deduct(user.id, 50)
    );
    
    const results = await Promise.allSettled(deductions);
    
    // MUST：只�?个成功（100/50=2�?
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);
    expect(successes.length).toBe(2);
    
    // MUST：最终余额为0
    const updated = await service.getBalance(user.id);
    expect(updated).toBe(0);
  });
});
```

## 边界条件测试模板

```typescript
// src/modules/coupon/coupon.boundary.test.ts
import { describe, it, expect } from 'vitest';

describe('Boundary Conditions �?MUST test extremes', () => {
  // 数值边�?
  describe('Numeric Boundaries', () => {
    it('should handle MAX_SAFE_INTEGER stock', async () => {
      const product = await service.create({ stock: Number.MAX_SAFE_INTEGER });
      const result = await service.purchase(product.id, 1, 1);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', async () => {
      const result = await service.purchase(1, 1, -1);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_QUANTITY');
    });

    it('should handle zero quantity gracefully', async () => {
      const result = await service.purchase(1, 1, 0);
      expect(result.success).toBe(false);
    });

    it('should handle very large quantity exceeding stock', async () => {
      const product = await service.create({ stock: 10 });
      const result = await service.purchase(product.id, 1, 999999);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  // 字符串边�?
  describe('String Boundaries', () => {
    it('should handle empty string coupon code', async () => {
      const result = await service.validateCoupon('');
      expect(result.valid).toBe(false);
    });

    it('should handle max length coupon code', async () => {
      const longCode = 'A'.repeat(255);
      const result = await service.create({ code: longCode });
      expect(result.code).toBe(longCode);
    });

    it('should reject code exceeding max length', async () => {
      const tooLong = 'A'.repeat(256);
      await expect(service.create({ code: tooLong }))
        .rejects.toThrow(/too long/);
    });
  });

  // 时间边界
  describe('Time Boundaries', () => {
    it('should reject coupon used before start time', async () => {
      const coupon = await service.create({
        code: 'FUTURE',
        startAt: new Date(Date.now() + 86400000), // 明天
      });
      const result = await service.use(coupon.code);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_STARTED');
    });

    it('should reject coupon used 1ms after expiry', async () => {
      const coupon = await service.create({
        code: 'EXPIRED',
        endAt: new Date(Date.now() - 1), // 1ms前过�?
      });
      const result = await service.use(coupon.code);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('EXPIRED');
    });

    it('should accept coupon at exact start time', async () => {
      const now = new Date();
      const coupon = await service.create({
        code: 'NOW',
        startAt: now,
        endAt: new Date(now.getTime() + 86400000),
      });
      const result = await service.use(coupon.code);
      expect(result.success).toBe(true);
    });
  });

  // 集合边界
  describe('Collection Boundaries', () => {
    it('should handle empty cart checkout', async () => {
      const result = await service.checkout({ items: [] });
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('EMPTY_CART');
    });

    it('should handle single item cart', async () => {
      const result = await service.checkout({ items: [{ id: 1, qty: 1 }] });
      expect(result.success).toBe(true);
    });

    it('should handle max items in cart', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, qty: 1 }));
      const result = await service.checkout({ items });
      expect(result.success).toBe(true);
    });
  });

  // 分页边界
  describe('Pagination Boundaries', () => {
    it('should handle page 0 (treat as page 1)', async () => {
      const result = await service.list({ page: 0, pageSize: 10 });
      expect(result.page).toBe(1);
    });

    it('should handle page beyond total', async () => {
      const result = await service.list({ page: 999, pageSize: 10 });
      expect(result.items).toEqual([]);
      expect(result.total).toBeDefined();
    });

    it('should handle pageSize = 0', async () => {
      const result = await service.list({ page: 1, pageSize: 0 });
      expect(result.items).toEqual([]);
    });

    it('should handle max pageSize', async () => {
      const result = await service.list({ page: 1, pageSize: 1000 });
      expect(result.items.length).toBeLessThanOrEqual(1000);
    });
  });
});
```

## 并发与边界测试覆盖率要求

| 测试类型 | 最低数�?| 说明 |
|---------|---------|------|
| 并发竞争 | 每个共享资源 | 同时修改同一资源的多个请�?|
| 库存/数量边界 | 每个计数�?| 0�?、max、负数、超大�?|
| 时间边界 | 每个时间字段 | 刚好开始、刚好过期、未来、过�?|
| 字符串边�?| 每个文本字段 | 空、最大长度、超长、特殊字�?|
| 集合边界 | 每个列表 | 空、单条、最大条�?|
| 分页边界 | 每个分页接口 | page=0、超大page、pageSize=0、超大pageSize |

---

# Stage 4.7: 地理围栏与定位测�?(MUST �?迭代12核心修复)

**问题**：O2O系统依赖地理位置（骑手配送范围、门店服务范围），之前地理计算bug只在人工测试时发现（如：坐标偏差导致配送范围判断错误）�?

**解决方案**：MUST 编写 **地理围栏测试**，覆盖坐标计算、距离算法、围栏判定�?

## 地理围栏测试模板

```typescript
// src/modules/delivery/delivery.geo.test.ts
import { describe, it, expect } from 'vitest';
import { GeoService } from './geo-service';

describe('O2O Geo-Fencing �?Location Testing', () => {
  const geo = new GeoService();

  // 测试1：距离计算精�?
  describe('Distance Calculation', () => {
    it('should calculate distance between two points correctly', () => {
      // 北京天安�?(116.397428, 39.90923)
      // 北京故宫 (116.397026, 39.916345)
      // 实际距离�?800�?
      const distance = geo.calculateDistance(
        { lat: 39.90923, lng: 116.397428 },
        { lat: 39.916345, lng: 116.397026 }
      );
      
      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(900);
    });

    it('should return 0 for same coordinates', () => {
      const point = { lat: 39.90923, lng: 116.397428 };
      const distance = geo.calculateDistance(point, point);
      expect(distance).toBe(0);
    });

    it('should handle coordinates near equator', () => {
      const distance = geo.calculateDistance(
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 }
      );
      // 经度1度在赤道�?11km
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });
  });

  // 测试2：配送范围判�?
  describe('Delivery Range Check', () => {
    it('should accept order within delivery range', () => {
      // 门店位置
      const store = { lat: 39.90923, lng: 116.397428 };
      // 用户位置（距�?00米）
      const customer = { lat: 39.912, lng: 116.397 };
      // 配送范�?km
      const inRange = geo.isWithinRange(store, customer, 3000);
      
      expect(inRange).toBe(true);
    });

    it('should reject order outside delivery range', () => {
      const store = { lat: 39.90923, lng: 116.397428 };
      // 用户位置（距�?km�?
      const customer = { lat: 39.95, lng: 116.397 };
      
      const inRange = geo.isWithinRange(store, customer, 3000);
      expect(inRange).toBe(false);
    });

    it('should handle edge case: exactly at boundary', () => {
      const store = { lat: 39.90923, lng: 116.397428 };
      // 精确计算3km边界上的�?
      const boundaryPoint = geo.pointAtDistance(store, 3000, 90);
      
      const inRange = geo.isWithinRange(store, boundaryPoint, 3000);
      expect(inRange).toBe(true); // 边界上算在范围内
    });
  });

  // 测试3：多边形围栏
  describe('Polygon Fence', () => {
    it('should detect point inside polygon', () => {
      // 定义一个三角形围栏
      const fence = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 10 },
        { lat: 10, lng: 5 },
      ];
      const point = { lat: 5, lng: 5 };
      
      expect(geo.isPointInPolygon(point, fence)).toBe(true);
    });

    it('should detect point outside polygon', () => {
      const fence = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 10 },
        { lat: 10, lng: 5 },
      ];
      const point = { lat: 20, lng: 20 };
      
      expect(geo.isPointInPolygon(point, fence)).toBe(false);
    });

    it('should handle point on polygon edge', () => {
      const fence = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 10 },
        { lat: 10, lng: 5 },
      ];
      const point = { lat: 0, lng: 5 }; // 在边�?
      
      expect(geo.isPointInPolygon(point, fence)).toBe(true);
    });
  });

  // 测试4：坐标格式验�?
  describe('Coordinate Validation', () => {
    it('should reject invalid latitude', () => {
      expect(geo.isValidCoordinate({ lat: 91, lng: 0 })).toBe(false);
      expect(geo.isValidCoordinate({ lat: -91, lng: 0 })).toBe(false);
    });

    it('should reject invalid longitude', () => {
      expect(geo.isValidCoordinate({ lat: 0, lng: 181 })).toBe(false);
      expect(geo.isValidCoordinate({ lat: 0, lng: -181 })).toBe(false);
    });

    it('should accept valid coordinates', () => {
      expect(geo.isValidCoordinate({ lat: 39.90923, lng: 116.397428 })).toBe(true);
      expect(geo.isValidCoordinate({ lat: 0, lng: 0 })).toBe(true);
      expect(geo.isValidCoordinate({ lat: -90, lng: 180 })).toBe(true);
    });
  });
});
```

## 地理围栏测试覆盖率要�?

| 测试类型 | 最低数�?| 说明 |
|---------|---------|------|
| 距离计算 | 每个距离函数 | 短距离、长距离、同一�?|
| 范围判定 | 每个配�?服务范围 | 范围内、范围外、边界上 |
| 多边�?| 每个围栏区域 | 内部、外部、边�?|
| 坐标验证 | 每个坐标输入 | 有效、无效、边界�?|
| 坐标系转�?| 涉及多坐标系�?| GCJ-02、WGS-84、BD-09 |

# Stage 6: Code Review

## Trigger Code Review When:

- GREEN phase test still fails after 3 attempts
- Refactor causes test failure
- Cross-module interface change
- Exception path not covered

## Code Review Request

```markdown
## Code Review 请求

**模块**: [module]
**阶段**: [RED/GREEN/REFACTOR]
**问题**: [具体问题描述]
**测试输出**: [测试错误信息]
**期望行为**: [正确的行为]

**代码位置**:
- [file:line]
- [file:line]

**请审�?*:
1. 实现逻辑是否正确
2. 异常处理是否完善
3. 是否符合api-contract.yaml约定
```

---

# Stage 7: Module Completion

## Completion Checklist

- [ ] All acceptance criteria have passing tests
- [ ] All interface endpoints implemented
- [ ] Schema consistency verified
- [ ] Exception paths covered
- [ ] Code review passed (if triggered)
- [ ] DONE marker created

## Create DONE Marker

```markdown
# DONE

**模块**: [module]
**完成时间**: [timestamp]
**测试用例�?*: [N]
**代码行数**: [N]

**验收标准覆盖**:
- [✅] [标准1]
- [✅] [标准2]

**遗留问题**: [�?/ 列出问题及原因]
```

---

# Constraints

**MUST DO:**
- Write test BEFORE implementation (RED first)
- Write minimum code to pass test (GREEN)
- Refactor only when tests pass
- Trigger code review on repeated failures

**MUST NOT DO:**
- Write implementation without tests
- Write more code than necessary to pass tests
- Skip exception handling (covered by tests)
- Leave failing tests when claiming completion

---

# Gotchas

- **RED must fail** �?If test passes without implementation, test is not testing anything real
- **GREEN minimum** �?Write exactly enough to pass, no optimization (that's refactor)
- **One assertion at a time** �?Multiple assertions in one test = hard to debug failure
- **Soft delete everywhere** �?Unless specified, use soft delete (add `WHERE deleted_at IS NULL`)
- **Transaction for multi-table** �?If operation touches multiple tables, use transaction
- **CR is mandatory before DONE** �?所有测试通过后必须触发终�?CR，通过后方可写�?DONE 标记
- **TDD 5轮上�?* �?超过 5 轮仍 FAIL �?BLOCKED，不要无限循�?
- **Regression test directory** �?Bug 修复后回归测试放�?`regression/bug-<编号>-<简�?.test.ts`
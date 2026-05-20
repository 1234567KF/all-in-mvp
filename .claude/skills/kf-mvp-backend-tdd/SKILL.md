---
name: kf-mvp-backend-tdd
description: >-
  Load when user asks to develop backend using TDD, implement module with
  test-first, or run red-green-refactor cycle. Triggers: TDD, 后端开发,
  红绿重构, 写测试, 测试驱动, backend, module implementation,
  RED GREEN REFACTOR. NOT for: frontend development, database schema design,
  or API contract design.
metadata:
  pattern: pipeline
  domain: mvp-stage3
recommended_model: pro
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

# MVP Backend TDD Developer — 后端TDD开发技能

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

1. **Red first** — Write a failing test before any implementation
2. **Green second** — Write minimum code to make test pass
3. **Refactor always** — Clean up code while tests stay green
4. **Code review on failure** — Green phase failure triggers review
5. **Default stack enforced** — Use Hono + Drizzle + SQLite unless user explicitly requests otherwise

---

# TDD Cycle

```
┌─ TDD Cycle ──────────────────────────────────┐
│                                              │
│  1. RED: Write failing test                  │
│     → Test should fail with current code     │
│                                              │
│  2. GREEN: Write minimal implementation      │
│     → Make test pass, no more                │
│     → IF test still fails → Trigger Review   │
│                                              │
│  3. REFACTOR: Clean up code                  │
│     → IF tests fail → Rollback or fix        │
│     → IF ok → Continue                       │
│                                              │
│  4. REPEAT until feature complete            │
│                                              │
└──────────────────────────────────────────────┘
```

---

# Code Review Triggers

| Situation | Review Trigger | Action |
|-----------|----------------|--------|
| Green phase test still fails | YES | Analyze failure, fix implementation |
| Refactor causes test failure | YES | Rollback or fix |
| New exception path needed | YES | Review exception handling |
| Cross-module interface change | YES | Verify contract consistency |

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

**模块名**: [module]
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

# Stage 3: RED Phase — Write Failing Test

## Test Location

**Unit tests**: `src/modules/<module>/<module>.test.ts`
**Integration tests**: `integration-tests/modules/<module>.test.ts`

## Test Structure (Vitest + Hono Test Adapter)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { moduleRoutes } from './routes';
import { getTestDb, seedTestData } from '@/tests/helpers';

describe('[Module] API', () => {
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
  });

  describe('POST /api/[module]', () => {
    it('should create resource with valid input', async () => {
      // Implementation
    });

    it('should return 400 with invalid input', async () => {
      // Implementation
    });
  });
});
```

**Tech Stack Note**: Uses Vitest (not Jest) + Hono's built-in `app.request()` for integration testing. SQLite in-memory database per test via `better-sqlite3`.

## RED Phase Rules

1. **Write test for happy path first**
2. **Run test → MUST fail** (otherwise test is not testing anything)
3. **Test must fail with meaningful error** (not syntax error)
4. **Do NOT write implementation** yet

**Output RED phase**:
```markdown
## RED Phase 状态

**测试文件**: src/modules/<module>/<module>.test.ts
**测试用例数**: [N]
**运行结果**: ❌ FAIL
  - [Test 1]: ❌ FAIL - [error message]
  - [Test 2]: ❌ FAIL - [error message]

**结论**: RED phase complete, proceed to GREEN
```

---

# Stage 4: GREEN Phase — Minimal Implementation

## Implementation Rules

1. **Write minimum code to make tests pass**
2. **Do NOT optimize** (optimization comes in refactor phase)
3. **Do NOT add features** not covered by tests
4. **IF test still fails after reasonable effort → Trigger Code Review**

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

1. **Test passes → Move to REFACTOR**
2. **Test fails → Analyze原因**
   - If implementation bug → Fix implementation
   - If test wrong → Fix test (but keep RED phase)
   - If requirement unclear → Ask for clarification
3. **After 3 attempts → Trigger Code Review**

---

# Stage 5: REFACTOR Phase

## Refactor Rules

1. **Only refactor when ALL tests pass**
2. **One small change at a time**
3. **Run tests after each change**
4. **If test fails → Rollback immediately**

## Common Refactors

- Extract method
- Rename variables for clarity
- Move inline code to helper
- Simplify conditional logic
- Add comments for complex logic

**Do NOT**:
- Change behavior (tests must stay green)
- Add new features
- Change public API (unless approved)

---

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

**请审查**:
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
**测试用例数**: [N]
**代码行数**: [N]

**验收标准覆盖**:
- [✅] [标准1]
- [✅] [标准2]

**遗留问题**: [无 / 列出问题及原因]
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

- **RED must fail** — If test passes without implementation, test is not testing anything real
- **GREEN minimum** — Write exactly enough to pass, no optimization (that's refactor)
- **One assertion at a time** — Multiple assertions in one test = hard to debug failure
- **Soft delete everywhere** — Unless specified, use soft delete (add `WHERE deleted_at IS NULL`)
- **Transaction for multi-table** — If operation touches multiple tables, use transaction
---
name: kf-mvp-schema-design
description: >-
  Load when user asks to design database schema, create tables, or define
  Drizzle ORM schema for MVP projects. Triggers: 数据库设�? schema, 表设�?
  数据库优�? database design, create table, drizzle, ORM, sqlite.
  NOT for: production database tuning, migration from other databases, or
  NoSQL schema design.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage2
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

# MVP Schema Designer �?数据库设计技�?

> **Core Belief**: Database schema is the foundation of the entire system. A well-designed schema prevents 90% of integration issues. Design once, query anywhere.

**Division of Labor**: This Skill focuses on **database schema design** using Tool Wrapper pattern. Provides best practices, templates, and Drizzle ORM conventions.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Database: SQLite (better-sqlite3)
- ORM: Drizzle ORM (`drizzle-orm/sqlite-core`)
- Schema file: `backend/src/db/schema.ts`

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **SQLite for MVP** �?Single file, zero config. Switch to MySQL/PostgreSQL later by changing Drizzle driver only
2. **Drizzle ORM** �?Type-safe, SQL-like syntax. Schema is TypeScript code, not SQL
3. **Soft delete default** �?Almost all business tables need `deleted_at`
4. **Audit trail** �?`created_at` and `updated_at` on every table
5. **Foreign key integrity** �?Enforced at application level (SQLite FK support)

---

# Naming Conventions

## Tables
- **Singular or Plural?** Use **plural** for entities: `users`, `products`, `trace_codes`
- **Separator**: snake_case only

## Columns
- **Primary Key**: `id` (integer auto-increment)
- **Foreign Key**: `{table_singular}_id` �?`user_id`, `product_id`
- **Timestamps**: `created_at`, `updated_at`
- **Soft Delete**: `deleted_at`
- **Audit**: `created_by`, `updated_by`

## Indexes
- **Prefix**: `idx_{table}_{columns}` �?`idx_users_email`

---

# Drizzle Schema Patterns

## Basic Table

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  deletedAt: text('deleted_at'),
});
```

## Table with Foreign Key

```typescript
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  organizationId: integer('organization_id').references(() => organizations.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  deletedAt: text('deleted_at'),
});
```

## Table with Enum

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const userRoles = ['admin', 'user', 'brand'] as const;

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  role: text('role', { enum: userRoles }).notNull().default('user'),
});
```

---

# SQL Schema Patterns

## Basic Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

CREATE INDEX idx_users_email ON users(email);
```

## Table with Foreign Key

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

CREATE INDEX idx_products_category ON products(category_id);
```

---

# Common Patterns

## Pattern 1: User Audit

```typescript
export const withAudit = (table: any) => {
  return {
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
    deletedAt: text('deleted_at'),
  };
};
```

## Pattern 2: Soft Delete Query

```typescript
// Use in all SELECT queries
const activeUsers = db.select().from(users)
  .where(isNull(users.deletedAt));
```

## Pattern 3: Timestamp Helper

```typescript
const now = () => new Date().toISOString();
```

---

# Index Design

## When to Add Index

| Situation | Add Index? |
|-----------|------------|
| Column in WHERE clause | �?Yes |
| Column in JOIN condition | �?Yes |
| Column in ORDER BY | �?Yes |
| Column with UNIQUE constraint | �?Yes (automatic) |
| Column with low selectivity | �?No |

## Composite Index

```sql
-- For queries: WHERE org_id = ? AND deleted_at IS NULL
CREATE INDEX idx_users_org_deleted ON users(organization_id, deleted_at);
```

---

# Schema Review Checklist

## Naming
- [ ] Table names are plural snake_case
- [ ] Column names are snake_case
- [ ] Primary keys are named `id`
- [ ] Foreign keys follow `{table}_id` convention

## Completeness
- [ ] All business tables have created_at/updated_at
- [ ] All business tables have deleted_at (soft delete)
- [ ] All foreign keys have corresponding indexes

## Integrity
- [ ] Required columns marked NOT NULL
- [ ] Unique constraints enforced
- [ ] Default values specified

## Performance
- [ ] Frequently queried columns indexed
- [ ] No unnecessary indexes
- [ ] Composite indexes for combined queries

---

# Data Consistency Testing (MUST �?迭代14核心修复)

**问题**：溯源系统的数据一致性（外键约束、级联删除、触发器）经常在操作后才发现问题（如：删除产品后溯源�?orphaned、关联数据不一致）�?

**解决方案**：MUST 编写 **数据一致性测�?*，覆盖外键约束、级联操作、触发器、约束验证�?

## 数据一致性测试模�?

```typescript
// tests/schema/consistency.test.ts
import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers';

describe('Traceability Data Consistency', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  // 测试1：外键约�?
  describe('Foreign Key Constraints', () => {
    it('should prevent creating trace code without product', async () => {
      await expect(
        db.insert(traceCodes).values({
          code: 'TRACE-001',
          productId: 99999, // 不存在的产品
        })
      ).rejects.toThrow(); // MUST: 外键约束错误
    });

    it('should cascade delete trace codes when product deleted', async () => {
      // 创建产品
      const product = await db.insert(products).values({ name: 'Test' }).returning();
      // 创建溯源�?
      await db.insert(traceCodes).values({ code: 'TRACE-001', productId: product[0].id });

      // 删除产品
      await db.delete(products).where(eq(products.id, product[0].id));

      // MUST: 溯源码也被删�?
      const codes = await db.select().from(traceCodes)
        .where(eq(traceCodes.productId, product[0].id));
      expect(codes).toHaveLength(0);
    });
  });

  // 测试2：唯一约束
  describe('Unique Constraints', () => {
    it('should prevent duplicate trace codes', async () => {
      await db.insert(traceCodes).values({ code: 'UNIQUE-001', productId: 1 });

      await expect(
        db.insert(traceCodes).values({ code: 'UNIQUE-001', productId: 2 })
      ).rejects.toThrow(); // MUST: 唯一约束错误
    });

    it('should prevent duplicate email in users', async () => {
      await db.insert(users).values({ email: 'test@example.com', passwordHash: 'xxx' });

      await expect(
        db.insert(users).values({ email: 'test@example.com', passwordHash: 'yyy' })
      ).rejects.toThrow();
    });
  });

  // 测试3：CHECK约束
  describe('CHECK Constraints', () => {
    it('should reject negative price', async () => {
      await expect(
        db.insert(products).values({ name: 'Bad', price: -100 })
      ).rejects.toThrow();
    });

    it('should reject quantity less than 0', async () => {
      await expect(
        db.insert(inventory).values({ productId: 1, warehouse: 'A', quantity: -5 })
      ).rejects.toThrow();
    });
  });

  // 测试4：触发器验证
  describe('Trigger Validation', () => {
    it('should auto-update updated_at on modify', async () => {
      const product = await db.insert(products).values({ name: 'Test' }).returning();
      const originalUpdatedAt = product[0].updatedAt;

      // 等待1�?
      await new Promise(r => setTimeout(r, 1000));

      // 更新产品
      await db.update(products)
        .set({ name: 'Updated' })
        .where(eq(products.id, product[0].id));

      const updated = await db.select().from(products)
        .where(eq(products.id, product[0].id)).limit(1);

      // MUST: updated_at被自动更�?
      expect(new Date(updated[0].updatedAt).getTime())
        .toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });

    it('should maintain inventory log on stock change', async () => {
      const product = await db.insert(products).values({ name: 'Test' }).returning();
      await db.insert(inventory).values({
        productId: product[0].id,
        warehouse: 'A',
        quantity: 100
      });

      // 更新库存
      await db.update(inventory)
        .set({ quantity: 80 })
        .where(eq(inventory.productId, product[0].id));

      // MUST: 库存日志表有记录
      const logs = await db.select().from(inventoryLogs)
        .where(eq(inventoryLogs.productId, product[0].id));
      expect(logs).toHaveLength(1);
      expect(logs[0].oldQuantity).toBe(100);
      expect(logs[0].newQuantity).toBe(80);
    });
  });

  // 测试5：数据完整性（ orphans 检测）
  describe('Orphan Detection', () => {
    it('should not have trace codes without products', async () => {
      const orphans = await db.select().from(traceCodes)
        .leftJoin(products, eq(traceCodes.productId, products.id))
        .where(isNull(products.id));

      expect(orphans).toHaveLength(0);
    });

    it('should not have order items without orders', async () => {
      const orphans = await db.select().from(orderItems)
        .leftJoin(orders, eq(orderItems.orderId, orders.id))
        .where(isNull(orders.id));

      expect(orphans).toHaveLength(0);
    });
  });
});
```

## 数据一致性测试覆盖率要求

| 测试类型 | 最低数�?| 说明 |
|---------|---------|------|
| 外键约束 | 每个外键关系 | 插入违反、级联删�?|
| 唯一约束 | 每个唯一索引 | 重复插入被拒�?|
| CHECK约束 | 每个CHECK | 边界值、无效�?|
| 触发�?| 每个触发�?| 触发条件、副作用 |
| Orphan检�?| 每个关联�?| 无主记录检�?|

# Constraints

**MUST DO:**
- Use singular for primary key name (id, not user_id)
- Add audit fields to all tables
- Add soft delete to business tables
- Index foreign keys

**MUST NOT DO:**
- Skip deleted_at on business tables
- Use camelCase naming
- Create indexes on low-selectivity columns
- Skip NOT NULL on required fields

---

# Gotchas

- **Soft delete everywhere** �?Unless specified, all business tables need deleted_at
- **Audit fields** �?created_at/updated_at auto-populated on INSERT/UPDATE
- **Cascade behavior** �?Drizzle doesn't auto-cascade deletes, handle in application
- **Index order** �?Composite index order matters; put most selective first
- **UUID vs Auto-increment** �?Use auto-increment for MVP; UUID for distributed systems
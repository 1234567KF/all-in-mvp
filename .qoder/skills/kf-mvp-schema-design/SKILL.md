---
name: kf-mvp-schema-design
description: >-
  Load when user asks to design database schema, create tables, or define
  Drizzle ORM schema for MVP projects. Triggers: 数据库设计, schema, 表设计,
  数据库优化, database design, create table, drizzle, ORM, sqlite.
  NOT for: production database tuning, migration from other databases, or
  NoSQL schema design.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

# MVP Schema Designer — 数据库设计技能

> **Core Belief**: Database schema is the foundation of the entire system. A well-designed schema prevents 90% of integration issues. Design once, query anywhere.

**Division of Labor**: This Skill focuses on **database schema design** using Tool Wrapper pattern. Provides best practices, templates, and Drizzle ORM conventions.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Database: SQLite (better-sqlite3)
- ORM: Drizzle ORM (`drizzle-orm/sqlite-core`)
- Schema file: `backend/src/db/schema.ts`

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **SQLite for MVP** — Single file, zero config. Switch to MySQL/PostgreSQL later by changing Drizzle driver only
2. **Drizzle ORM** — Type-safe, SQL-like syntax. Schema is TypeScript code, not SQL
3. **Soft delete default** — Almost all business tables need `deleted_at`
4. **Audit trail** — `created_at` and `updated_at` on every table
5. **Foreign key integrity** — Enforced at application level (SQLite FK support)

---

# Naming Conventions

## Tables
- **Singular or Plural?** Use **plural** for entities: `users`, `products`, `trace_codes`
- **Separator**: snake_case only

## Columns
- **Primary Key**: `id` (integer auto-increment)
- **Foreign Key**: `{table_singular}_id` → `user_id`, `product_id`
- **Timestamps**: `created_at`, `updated_at`
- **Soft Delete**: `deleted_at`
- **Audit**: `created_by`, `updated_by`

## Indexes
- **Prefix**: `idx_{table}_{columns}` → `idx_users_email`

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
| Column in WHERE clause | ✅ Yes |
| Column in JOIN condition | ✅ Yes |
| Column in ORDER BY | ✅ Yes |
| Column with UNIQUE constraint | ✅ Yes (automatic) |
| Column with low selectivity | ❌ No |

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

- **Soft delete everywhere** — Unless specified, all business tables need deleted_at
- **Audit fields** — created_at/updated_at auto-populated on INSERT/UPDATE
- **Cascade behavior** — Drizzle doesn't auto-cascade deletes, handle in application
- **Index order** — Composite index order matters; put most selective first
- **UUID vs Auto-increment** — Use auto-increment for MVP; UUID for distributed systems
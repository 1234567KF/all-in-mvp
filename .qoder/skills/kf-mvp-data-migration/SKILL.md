---
name: kf-mvp-data-migration
description: >-
  Load when user asks for database migration, data transformation, or schema
  updates. Triggers: 数据库迁移, 数据迁移, schema更新, migration,
  drizzle migrate, 数据转换, data transform. Also load when updating database
  schema or migrating data between versions.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-schema-design
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Data Migration — 数据迁移技能

> **Core Belief**: Data migrations are dangerous. Do them wrong, and you lose data. Do them right, and users never notice. Zero downtime is the goal.

**Division of Labor**: This Skill focuses on **database migration strategies** using Tool Wrapper pattern. Provides patterns for schema changes, data transformation, and rollback.

---

# Core Philosophy

1. **Backup first** — Always have a rollback point
2. **Incremental changes** — Small steps are safer
3. **Zero downtime** — Users shouldn't notice migrations
4. **Test on real data** — Staging ≠ production

---

# Drizzle Migration Setup

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Commands

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema changes directly (dev only)
npx drizzle-kit push

# Drop all tables
npx drizzle-kit drop
```

---

# Migration Patterns

## Pattern 1: Add Column

```sql
-- Safe: Add nullable column first
ALTER TABLE users ADD COLUMN phone TEXT;

-- Then backfill data (in application code)
UPDATE users SET phone = '' WHERE phone IS NULL;

-- Then add NOT NULL constraint
ALTER TABLE users ALTER COLUMN phone TEXT NOT NULL;
```

## Pattern 2: Rename Column

```sql
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Step 2: Backfill from old column
UPDATE users SET display_name = name;

-- Step 3: Update application code to write both

-- Step 4: Verify data sync

-- Step 5: Remove old column
ALTER TABLE users DROP COLUMN name;
```

## Pattern 3: Add Index (Online)

```sql
-- Create index without blocking writes (SQLite/MySQL)
CREATE INDEX idx_users_email ON users(email);

-- For large tables, use concurrent index (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

## Pattern 4: Data Transformation

```typescript
// migrations/001_transform_data.ts
import { sqlite } from 'drizzle-orm/libsql';
import { users } from '../src/schema';

export async function up(db: Database) {
  // Transform: move first_name + last_name to full_name
  const allUsers = await db.select().from(users);
  
  for (const user of allUsers) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    await db
      .update(users)
      .set({ fullName })
      .where(eq(users.id, user.id));
  }
}

export async function down(db: Database) {
  // Reverse transformation
  const allUsers = await db.select().from(users);
  
  for (const user of allUsers) {
    const parts = (user.fullName || '').split(' ');
    await db
      .update(users)
      .set({
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
      })
      .where(eq(users.id, user.id));
  }
}
```

---

# Rollback Strategy

## Always Include Down Migrations

```typescript
// migrations/001_add_phone.ts
export async function up(db: Database) {
  await db.run(sql`ALTER TABLE users ADD COLUMN phone TEXT`);
}

export async function down(db: Database) {
  await db.run(sql`ALTER TABLE users DROP COLUMN phone`);
}
```

## Verify Before Rollback

```typescript
// Before rolling back, verify:
// 1. Backup is available
// 2. Down migration is tested
// 3. Application code handles pre-migration state
```

---

# Migration Checklist

## Pre-Migration
- [ ] Backup created and verified
- [ ] Migration tested on staging
- [ ] Application handles both old and new schema
- [ ] Rollback plan documented

## During Migration
- [ ] Monitor for errors
- [ ] Check migration duration
- [ ] Verify data integrity

## Post-Migration
- [ ] Application works correctly
- [ ] No data loss
- [ ] Performance acceptable
- [ ] Monitoring looks good

---

# Migration Testing (MUST — 迭代9核心修复)

**问题**：CRM系统的数据迁移（客户数据、订单历史）经常在迁移后发现数据丢失或格式错误，之前迁移测试只在人工抽查时进行，覆盖率不足。

**解决方案**：MUST 编写 **迁移测试**，覆盖数据完整性、格式转换、回滚验证。

## 迁移测试模板

```typescript
// tests/migration/001_add_customer_tags.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createTestDb, getTestDb } from '../helpers';

describe('Migration 001 — Add Customer Tags (CRM)', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeAll(async () => {
    db = createTestDb({ schema: 'pre-migration' }); // 迁移前schema
    // 插入测试数据
    await db.insert(customers).values([
      { id: 1, name: 'Alice', email: 'alice@example.com', category: 'VIP' },
      { id: 2, name: 'Bob', email: 'bob@example.com', category: 'Regular' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', category: null },
    ]);
  });

  // 测试1：迁移前数据完整性
  describe('Pre-Migration Data Integrity', () => {
    it('should have all customer records before migration', async () => {
      const count = await db.select({ count: sql`count(*)` }).from(customers);
      expect(count[0].count).toBe(3);
    });

    it('should have expected data types', async () => {
      const customer = await db.select().from(customers).where(eq(customers.id, 1)).limit(1);
      expect(typeof customer[0].name).toBe('string');
      expect(customer[0].category).toBeOneOf(['VIP', 'Regular', null]);
    });
  });

  // 测试2：迁移执行
  describe('Migration Execution', () => {
    it('should apply migration without errors', async () => {
      await expect(migrate(db, { migrationsFolder: './drizzle' }))
        .resolves.not.toThrow();
    });

    it('should add new tags column', async () => {
      const result = await db.select().from(customers).limit(1);
      expect(result[0]).toHaveProperty('tags');
    });

    it('should preserve all existing data', async () => {
      const allCustomers = await db.select().from(customers);
      expect(allCustomers).toHaveLength(3);
      expect(allCustomers.map(c => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  // 测试3：数据转换验证
  describe('Data Transformation', () => {
    it('should convert category to tags correctly', async () => {
      const alice = await db.select().from(customers).where(eq(customers.id, 1)).limit(1);
      expect(alice[0].tags).toContain('VIP'); // category:VIP → tags包含VIP
    });

    it('should handle null category gracefully', async () => {
      const charlie = await db.select().from(customers).where(eq(customers.id, 3)).limit(1);
      expect(charlie[0].tags).toEqual([]); // null → 空数组
    });

    it('should not create duplicate tags', async () => {
      // 如果运行迁移两次
      await migrate(db, { migrationsFolder: './drizzle' });
      const alice = await db.select().from(customers).where(eq(customers.id, 1)).limit(1);
      expect(new Set(alice[0].tags).size).toBe(alice[0].tags.length);
    });
  });

  // 测试4：回滚验证
  describe('Rollback Verification', () => {
    it('should restore original schema on rollback', async () => {
      // 执行回滚
      await db.run(sql`ALTER TABLE customers DROP COLUMN tags`);
      
      const result = await db.select().from(customers).limit(1);
      expect(result[0]).not.toHaveProperty('tags');
    });

    it('should preserve data after rollback', async () => {
      const allCustomers = await db.select().from(customers);
      expect(allCustomers.map(c => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  // 测试5：边界情况
  describe('Edge Cases', () => {
    it('should handle empty table migration', async () => {
      const emptyDb = createTestDb({ schema: 'pre-migration' });
      await expect(migrate(emptyDb, { migrationsFolder: './drizzle' }))
        .resolves.not.toThrow();
    });

    it('should handle large dataset migration', async () => {
      const largeDb = createTestDb({ schema: 'pre-migration' });
      // 插入10000条记录
      const batch = Array.from({ length: 10000 }, (_, i) => ({
        name: `User${i}`,
        email: `user${i}@example.com`,
        category: i % 2 === 0 ? 'VIP' : 'Regular'
      }));
      await largeDb.insert(customers).values(batch);
      
      const start = Date.now();
      await migrate(largeDb, { migrationsFolder: './drizzle' });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(30000); // MUST: 30秒内完成
    });
  });
});
```

## 迁移测试覆盖率要求

| 测试类型 | 最低数量 | 说明 |
|---------|---------|------|
| 数据完整性 | 每个迁移 | 迁移前后记录数一致 |
| 格式转换 | 每个转换逻辑 | 旧格式→新格式正确性 |
| 回滚验证 | 每个迁移 | 回滚后schema和数据恢复 |
| 幂等性 | 每个迁移 | 重复执行不产生副作用 |
| 性能 | 大数据量迁移 | 大表迁移时间可接受 |
| 边界 | 空表/大表 | 极端情况处理 |

# Constraints

**MUST DO:**
- Backup before migration
- Test rollback
- Monitor during migration
- Keep migration idempotent

**MUST NOT DO:**
- Drop columns without data migration
- Skip pre-migration testing
- Deploy without rollback capability
- Ignore migration locks

---

# Gotchas

- **Migration locks** — Some DB operations lock the table
- **Large table migrations** — Process in batches to avoid memory issues
- **Index creation time** — Indexes on large tables take time
- **Time zones** — Always use UTC for timestamp storage
- **String lengths** — Verify new column lengths match application expectations
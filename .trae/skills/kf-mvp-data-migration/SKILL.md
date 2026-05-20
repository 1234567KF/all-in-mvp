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
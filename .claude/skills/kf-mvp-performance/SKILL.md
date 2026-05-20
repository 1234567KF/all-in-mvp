---
name: kf-mvp-performance
description: >-
  Load when user asks for performance optimization, profiling, or speed
  improvements. Triggers: 性能优化, 性能调优, profiling, 速度优化,
  performance, 数据库优化, query optimization. Also load when application
  is slow or resource usage is high.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-schema-design
      type: semantic
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Performance — 性能优化技能

> **Core Belief**: Premature optimization is the root of all evil. Profile first, optimize second. The 20% of code causing 80% of slowdown is what matters.

**Division of Labor**: This Skill focuses on **performance profiling and optimization** using Tool Wrapper pattern. Provides profiling techniques and optimization strategies.

---

# Core Philosophy

1. **Measure first** — Don't guess what's slow, measure it
2. **Focus on bottlenecks** — 20% of code causes 80% of slowdown
3. **Meaningful targets** — "faster" needs numbers
4. **Maintainability matters** — Don't break code for 10ms gains

---

# Performance Checklist

## Database
| Check | Status | Impact |
|-------|--------|--------|
| Indexes on WHERE columns | | |
| Query uses indexes (EXPLAIN) | | |
| No N+1 queries | | |
| Connection pooling | | |
| Batch inserts for bulk data | | |

## API
| Check | Status | Impact |
|-------|--------|--------|
| Response caching | | |
| Compression enabled | | |
| Pagination implemented | | |
| Async operations used | | |
| No blocking in handlers | | |

## Frontend
| Check | Status | Impact |
|-------|--------|--------|
| Lazy loading | | |
| Code splitting | | |
| Asset optimization | | |
| Image optimization | | |
| Caching headers | | |

---

# Database Query Optimization

## EXPLAIN Analysis

```sql
-- Analyze query plan
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com';
```

## Index Creation

```sql
-- Single column index
CREATE INDEX idx_users_email ON users(email);

-- Composite index (for queries filtering on multiple columns)
CREATE INDEX idx_products_org_deleted 
  ON products(organization_id, deleted_at);

-- Partial index (for common filter)
CREATE INDEX idx_users_active 
  ON users(email) 
  WHERE deleted_at IS NULL;
```

## N+1 Query Detection

```typescript
// BAD - N+1 query
const users = await db.select().from(usersTable);
for (const user of users) {
  user.organization = await db.select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));
}

// GOOD - Join
const result = await db
  .select({
    user: usersTable,
    org: organizationsTable,
  })
  .from(usersTable)
  .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id));
```

---

# API Response Caching

```typescript
// Redis caching example
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedUsers(page: number) {
  const cacheKey = `users:page:${page}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from DB
  const users = await db.select().from(usersTable);
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(users));
  
  return users;
}

// Invalidation on write
async function createUser(data: CreateUserDto) {
  const user = await db.insert(usersTable).values(data);
  
  // Invalidate list caches
  const keys = await redis.keys('users:page:*');
  await redis.del(...keys);
  
  return user;
}
```

---

# API Response Compression

```typescript
import { compress } from 'hono/compress';

app.use(compress());
```

---

# Profiling Commands

```bash
# Database query analysis
npx drizzle-kit check

# API response time
curl -w '\nTime: %{time_total}s\n' http://localhost:3000/api/users

# Load testing
npx autocannon -c 10 -d 10 http://localhost:3000/api/users
```

---

# Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| API response (p99) | < 200ms | < 500ms |
| API response (p95) | < 100ms | < 200ms |
| Page load | < 2s | < 5s |
| Database query | < 50ms | < 100ms |

---

# Constraints

**MUST DO:**
- Profile before optimizing
- Set measurable targets
- Test with production-like data
- Monitor after changes

**MUST NOT DO:**
- Optimize without measurement
- Sacrifice correctness for speed
- Break existing tests
- Ignore caching strategies

---

# Gotchas

- **Indexes have cost** — Write performance suffers slightly
- **Cache invalidation** — Harder than it looks
- **Connection pool** — Set appropriate pool size
- **Pagination** — Never return all records
- **Async I/O** — Use for database, file, network ops
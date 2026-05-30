---
name: kf-mvp-performance
description: >-
  Load when user asks for performance optimization, profiling, or speed
  improvements. Triggers: 性能优化, 性能调优, profiling, 速度优化,
  performance, 数据库优�? query optimization. Also load when application
  is slow or resource usage is high.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: deepseek-v4-pro
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


# MVP Performance �?性能优化技�?

> **Core Belief**: Premature optimization is the root of all evil. Profile first, optimize second. The 20% of code causing 80% of slowdown is what matters.

**Division of Labor**: This Skill focuses on **performance profiling and optimization** using Tool Wrapper pattern. Provides profiling techniques and optimization strategies.

---

# Core Philosophy

1. **Measure first** �?Don't guess what's slow, measure it
2. **Focus on bottlenecks** �?20% of code causes 80% of slowdown
3. **Meaningful targets** �?"faster" needs numbers
4. **Maintainability matters** �?Don't break code for 10ms gains

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

# Load & Stress Testing (MUST �?迭代10核心修复)

**问题**：工单系统的性能问题（查询慢、响应超时）经常在上线后才暴露，之前性能测试只在开发环境进行，无法反映真实负载�?

**解决方案**：MUST 编写 **负载测试** �?**压力测试**，使�?autocannon �?k6 模拟真实并发�?

## 负载测试模板

```typescript
// tests/performance/ticket-load.test.ts
import { describe, it, expect } from 'vitest';
import autocannon from 'autocannon';
import { buildApp } from '@/app';

describe('Ticket System �?Load Testing', () => {
  let app: ReturnType<typeof buildApp>;
  let url: string;

  beforeAll(async () => {
    app = buildApp();
    // 启动测试服务�?
    const server = app.listen(0);
    url = `http://localhost:${server.port}`;
  });

  // 基准测试：单用户正常操作
  it('should handle single user within 200ms (p99)', async () => {
    const result = await autocannon({
      url: `${url}/api/tickets`,
      connections: 1,
      duration: 10,
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(result.latency.p99).toBeLessThan(200);
    expect(result.errors).toBe(0);
  });

  // 负载测试�?0并发用户
  it('should handle 10 concurrent users within 500ms (p99)', async () => {
    const result = await autocannon({
      url: `${url}/api/tickets`,
      connections: 10,
      duration: 30,
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(result.latency.p99).toBeLessThan(500);
    expect(result.errors).toBeLessThan(5); // 错误�?< 1%
    expect(result.throughput.average).toBeGreaterThan(50); // 每秒50+请求
  });

  // 压力测试�?00并发用户
  it('should handle 100 concurrent users without crashing', async () => {
    const result = await autocannon({
      url: `${url}/api/tickets`,
      connections: 100,
      duration: 60,
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(result.errors).toBeLessThan(100); // 错误�?< 10%
    expect(result.timeouts).toBe(0); // MUST: 无超�?
  });

  // 数据库查询性能测试
  it('should query ticket list with 10k records within 100ms', async () => {
    // 预插�?0000条工�?
    const db = getTestDb();
    const tickets = Array.from({ length: 10000 }, (_, i) => ({
      title: `Ticket ${i}`,
      status: ['PENDING', 'IN_PROGRESS', 'RESOLVED'][i % 3],
      createdAt: new Date().toISOString(),
    }));
    await db.insert(ticketTable).values(tickets);

    const start = Date.now();
    const res = await fetch(`${url}/api/tickets?page=1&pageSize=20`, {
      headers: { Authorization: 'Bearer test-token' }
    });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(100);
  });

  // 内存泄漏测试
  it('should not leak memory under sustained load', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // 持续请求5分钟
    await autocannon({
      url: `${url}/api/tickets`,
      connections: 50,
      duration: 300,
      headers: { Authorization: 'Bearer test-token' },
    });

    // 强制GC后检查内�?
    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage().heapUsed;
    const growth = (finalMemory - initialMemory) / initialMemory;

    expect(growth).toBeLessThan(0.5); // 内存增长 < 50%
  });
});
```

## 性能测试指标

| 指标 | 目标�?| 临界�?| 测试场景 |
|------|--------|--------|---------|
| API响应(p99) | < 200ms | < 500ms | 正常负载 |
| API响应(p95) | < 100ms | < 200ms | 正常负载 |
| 并发10用户 | < 500ms | < 1000ms | 中等负载 |
| 并发100用户 | < 2000ms | < 5000ms | 高负�?|
| 数据库查�?| < 50ms | < 100ms | 单表10k记录 |
| 内存增长 | < 50% | < 100% | 5分钟持续负载 |
| 错误�?| < 1% | < 5% | 任何负载 |
| 超时�?| 0% | < 1% | 任何负载 |

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

- **Indexes have cost** �?Write performance suffers slightly
- **Cache invalidation** �?Harder than it looks
- **Connection pool** �?Set appropriate pool size
- **Pagination** �?Never return all records
- **Async I/O** �?Use for database, file, network ops
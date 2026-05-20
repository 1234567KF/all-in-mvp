---
name: kf-mvp-caching
description: >-
  Load when user asks for caching strategies, cache implementation, or cache
  optimization. Triggers: 缓存, caching, 缓存策略, cache optimization,
  Redis, 性能优化, memory cache, 缓存层. Also load when implementing
  caching layers or solving performance issues.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-performance
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


# MVP Caching — 缓存策略技能

> **Core Belief**: Caching is not a feature, it's an optimization. Cache at the right layer, with the right TTL, and invalidate deliberately. Caching bugs are worse than no caching.

**Division of Labor**: This Skill focuses on **caching patterns and implementation** using Tool Wrapper pattern. Provides caching strategies, implementation patterns, and invalidation mechanisms.

---

# Caching Layers

```
┌─────────────────────────────────────────────────────────┐
│  Browser Cache                                          │
│  - Static assets                                       │
│  - Cache-Control headers                              │
├─────────────────────────────────────────────────────────┤
│  CDN (CloudFlare, etc.)                               │
│  - Static content                                     │
│  - API responses (if configured)                     │
├─────────────────────────────────────────────────────────┤
│  Application Cache (in-memory)                        │
│  - User sessions                                      │
│  - Frequently accessed data                          │
├─────────────────────────────────────────────────────────┤
│  Database Query Cache                                  │
│  - Query results                                      │
│  - Prepared statements                                │
└─────────────────────────────────────────────────────────┘
```

---

# HTTP Caching

## Cache-Control Headers

```typescript
// Static assets - long cache
app.use('/assets/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'public, max-age=31536000'); // 1 year
});

// API responses - no cache (or short)
app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

// User-specific - private
app.get('/api/users/me', async (c) => {
  const user = c.get('user');
  c.header('Cache-Control', 'private, max-age=300'); // 5 min
});
```

## ETag for Conditional Requests

```typescript
import { createHash } from 'crypto';

app.get('/api/users', async (c) => {
  const users = await getUsers();
  const etag = createHash('md5').update(JSON.stringify(users)).digest('hex');
  
  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch === etag) {
    return c.body(null, 304);
  }
  
  c.header('ETag', etag);
  return c.json({ data: users });
});
```

---

# In-Memory Cache

```typescript
// src/lib/cache.ts
interface CacheEntry<T> {
  value: T;
  expires: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }
  
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.match(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new MemoryCache();
```

---

# Redis Cache Pattern

```typescript
// src/lib/redis.ts
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL);

// Cache helper
export async function cacheGet<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  if (!cached) return null;
  return JSON.parse(cached);
}

export async function cacheSet<T>(
  key: string, 
  value: T, 
  ttlSeconds: number
): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheInvalidate(key: string): Promise<void> {
  await redis.del(key);
}

// Cached function decorator
export function cached(ttlSeconds: number) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
      
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
      
      const result = await original.apply(this, args);
      await cacheSet(cacheKey, result, ttlSeconds);
      
      return result;
    };
    
    return descriptor;
  };
}

// Usage
class UserService {
  @cached(300) // 5 minutes
  async getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id));
  }
}
```

---

# Cache Invalidation Patterns

## Write-Through

```typescript
async function createUser(data: CreateUserDto) {
  const user = await db.insert(users).values(data);
  
  // Write to cache immediately
  await cacheSet(`user:${user.id}`, user, 3600);
  
  return user;
}
```

## Write-Behind

```typescript
async function updateUser(id: number, data: UpdateUserDto) {
  // Update DB immediately
  const user = await db.update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning();
  
  // Invalidate cache (will be repopulated on next read)
  await cacheInvalidate(`user:${id}`);
  
  return user;
}
```

## Event-Based Invalidation

```typescript
// When related data changes
async function deleteOrganization(id: number) {
  await db.delete(organizations).where(eq(organizations.id, id));
  
  // Invalidate all related caches
  await redis.del(...[
    `org:${id}`,
    `users:org:${id}`,
    `products:org:${id}`,
  ]);
}
```

---

# Constraints

**MUST DO:**
- Set appropriate TTLs
- Invalidate on writes
- Handle cache misses
- Monitor cache hit rates

**MUST NOT DO:**
- Cache sensitive data unencrypted
- Cache indefinitely
- Skip cache invalidation
- Cache without measuring

---

# Gotchas

- **TTL** — Too short = no benefit, too long = stale data
- **Invalidation** — Harder than caching; plan upfront
- **Cold cache** — First request always slower; consider warm-up
- **Memory** — In-memory cache limited by RAM
- **Serialization** — Cache adds JSON parse/encode overhead
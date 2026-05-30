---
name: kf-mvp-api-versioning
description: >-
  Load when user asks for API versioning, breaking changes, or version management.
  Triggers: APIç‰ˆæœ¬, ç‰ˆæœ¬ç®¡ç†, versioning, breaking changes, APIæ¼”è¿›,
  ç‰ˆæœ¬æŽ§åˆ¶, v1 v2, RESTç‰ˆæœ¬. Also load when planning API changes.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage2
recommended_model: deepseek-v4-pro
graph:
  dependencies:
    - target: kf-mvp-api-contract
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


# MVP API Versioning â€?APIç‰ˆæœ¬ç®¡ç†æŠ€èƒ?

> **Core Belief**: API versioning is about managing change without breaking clients. The best versioning is the one clients don't notice. Additive changes are free; breaking changes require versions.

**Division of Labor**: This Skill focuses on **API versioning strategies** using Tool Wrapper pattern. Provides URL versioning, header versioning, and evolution patterns.

---

# Versioning Strategies

## 1. URL Path Versioning (Recommended for public APIs)

```
https://api.example.com/v1/users
https://api.example.com/v2/users
```

## 2. Header Versioning

```http
GET /api/users HTTP/1.1
Accept: application/vnd.api.v1+json
```

## 3. Query Parameter

```
/api/users?version=2
```

---

# URL Versioning Implementation

```typescript
// src/routes/v1/users.ts
export const v1Users = new Hono();

v1Users.get('/', async (c) => {
  // v1 behavior
  const users = await db.select().from(usersTable);
  return c.json({ data: users });
});

// v1 specific endpoints
v1Users.post('/batch', async (c) => {
  // v1 had batch endpoint
  return c.json({ /* ... */ });
});
```

```typescript
// src/routes/v2/users.ts
export const v2Users = new Hono();

v2Users.get('/', async (c) => {
  // v2 has improved pagination
  const { page = 1, limit = 20 } = c.req.query();
  const offset = (page - 1) * limit;
  
  const users = await db.select()
    .from(usersTable)
    .limit(limit)
    .offset(offset);
    
  return c.json({ data: users, meta: { page, limit } });
});
```

```typescript
// src/index.ts
app.route('/v1', v1Users);  // Mount v1
app.route('/v2', v2Users);  // Mount v2
```

---

# Breaking vs Non-Breaking Changes

## Non-Breaking Changes (No new version needed)

| Change | Example |
|--------|---------|
| Add new endpoints | `GET /api/users/preferences` |
| Add optional parameters | `GET /api/users?include=org` |
| Add new response fields | `{ name: "John", age: 30 }` â†?add `avatar: "..."` |
| Change field order | `{ a: 1, b: 2 }` â†?`{ b: 2, a: 1 }` |
| Add new enum values | `status: 'pending' | 'active'` â†?add `'archived'` |

## Breaking Changes (New version required)

| Change | Example |
|--------|---------|
| Remove endpoints | Remove `GET /api/users/legacy` |
| Remove response fields | Remove `password_hash` from response |
| Change parameter types | `id: string` â†?`id: number` |
| Change validation rules | `name` required â†?optional |
| Change authentication | Remove auth requirement |

---

# Version Deprecation

```typescript
// Deprecation middleware
app.use('/v1/*', async (c, next) => {
  const response = await next();
  
  // Add deprecation header
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', 'Sat, 01 Jan 2025 00:00:00 GMT');
  response.headers.set(
    'Link', 
    '<https://api.example.com/v2>; rel=" successor"'
  );
  
  // Log deprecation warning
  logger.warn({ path: c.req.path }, 'Deprecated endpoint called');
  
  return response;
});
```

---

# Client Migration Guide

```markdown
# Migration Guide: v1 â†?v2

## Changes

### Pagination
**Before (v1)**:
```json
{ "data": [...], "total": 100 }
```

**After (v2)**:
```json
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 100 } }
```

### Response Format
**Before (v1)**:
```json
{ "user": { "id": 1, "name": "John" } }
```

**After (v2)**:
```json
{ "data": { "id": 1, "name": "John" } }
```

## Migration Steps

1. Update client to handle new response envelope
2. Update pagination handling
3. Remove deprecated endpoint usage
4. Test with v2 endpoints

## Timeline
- **2024-01-01**: v2 released
- **2024-07-01**: v1 deprecated
- **2025-01-01**: v1 sunset
```

---

# Constraints

**MUST DO:**
- Document breaking changes clearly
- Provide migration guides
- Support old versions during transition
- Use clear deprecation headers

**MUST NOT DO:**
- Make breaking changes without new version
- Remove versions without warning
- Add breaking changes to current version
- Skip changelog documentation

---

# Gotchas

- **Additive is safe** â€?New fields don't break existing clients
- **Version length** â€?Support at least 2 versions simultaneously
- **Sunset date** â€?Give clients at least 6 months notice
- **Major version** â€?Only increment for breaking changes
- **Beta** â€?Use beta versions for experimental features
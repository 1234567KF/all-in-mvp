---
name: kf-mvp-mock-service
description: >-
  Load when user asks to create mock API, setup mock server, or generate mock
  data for frontend development. Triggers: mock, 模拟服务, 接口模拟, mock server,
  模拟数据, mock数据, 生成mock. NOT for: production API stubs, contract testing,
  or backend service mocking.
metadata:
  pattern: generator
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

# MVP Mock Service — Mock服务生成技能

> **Core Belief**: Frontend should never wait for backend. Mock first, develop in parallel, swap when real API is ready.

**Division of Labor**: This Skill focuses on **mock service generation** based on api-contract.yaml. It outputs a standalone mock server with realistic responses. Follows Generator pattern with strict templates.

**Default Tech Stack Context**:
- Mock server runs alongside Hono backend (same framework, same response format)
- OR: Standalone mock using Hono for consistency
- Response format MUST match real API: `{ success, data/error }`
- Seed data in `backend/src/seed.ts` for shared use

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Mock is based on contract** — api-contract.yaml is the only source of truth
2. **Realistic responses** — Mock data should look real (seed data, variations)
3. **Same framework as backend** — Use Hono for mock server (not Express) to ensure behavior consistency
4. **Failure simulation** — Can simulate error cases for frontend error handling
5. **Shared seed data** — Mock and real backend use same seed data source

---

# Output Artifacts

```
mocks/
├── server.ts              # Mock server entry
├── routes/
│   ├── auth.ts           # Auth mock routes
│   ├── users.ts          # Users mock routes
│   ├── products.ts       # Products mock routes
│   └── ...
├── data/
│   ├── users.json       # Seed data
│   ├── products.json     # Seed data
│   └── ...
└── utils/
    └── delay.ts          # Simulate network latency
```

---

# Stage 1: Read API Contract

**Confirm inputs**:
- [ ] api-contract.yaml is available
- [ ] `<module>.md` files are available

**Extract**:
- All routes and methods
- Request/Response DTOs
- Error codes

---

# Stage 2: Server Setup

## Hono Mock Server Template (MUST — 与后端同框架保证一致性)

**关键修复**：之前使用 Express 做 Mock，后端用 Hono，导致行为不一致（中间件顺序、错误处理、响应格式）。**Mock 服务器 MUST 使用 Hono**，与后端完全一致。

```typescript
// mocks/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { productRoutes } from './routes/products';

const app = new Hono();

// CORS — 与后端完全相同的配置
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Logger
app.use(logger());

// Simulate network latency (100-500ms) — 与真实网络一致
app.use('*', async (c, next) => {
  const delay = Math.floor(Math.random() * 400) + 100;
  await new Promise(resolve => setTimeout(resolve, delay));
  await next();
});

// 统一响应格式 — MUST 与后端完全一致
app.use('*', async (c, next) => {
  await next();
  // 如果响应已经是 JSON 且包含 success 字段，不处理
  // 否则包装为标准格式
});

// Auth middleware simulation — Hono 风格
app.use('/api/*', async (c, next) => {
  const token = c.req.header('authorization')?.replace('Bearer ', '');
  if (token === 'mock-token') {
    c.set('userId', '1');
    c.set('userRole', 'admin');
  }
  await next();
});

// Routes — Hono 风格
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/products', productRoutes);

// Error handling — Hono 风格
app.onError((err, c) => {
  console.error('Mock server error:', err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Mock server error'
    }
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  }, 404);
});

const PORT = 3001;
console.log(`Mock server running on http://localhost:${PORT}`);
export default app;
```

---

# Stage 3: Route Implementation

## Auth Mock Routes

```typescript
// mocks/routes/auth.ts
import { Hono } from 'hono';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  // Valid mock credentials
  if (email === 'admin@example.com' && password === 'password') {
    return c.json({
      success: true,
      data: {
        token: 'mock-token',
        user: {
          id: 1,
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin'
        }
      }
    });
  }

  // Invalid credentials
  return c.json({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    }
  }, 401);
});

authRoutes.post('/register', async (c) => {
  const body = await c.req.json();
  const { email, password, name } = body;

  // Check for duplicate
  if (email === 'existing@example.com') {
    return c.json({
      success: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered'
      }
    }, 409);
  }

  // Success
  return c.json({
    success: true,
    data: {
      token: 'mock-token-new',
      user: {
        id: Math.floor(Math.random() * 10000),
        email,
        name,
        role: 'user'
      }
    }
  }, 201);
});
```

## CRUD Mock Routes Template

```typescript
// mocks/routes/{module}.ts
import { Hono } from 'hono';
import seedData from '../data/{module}.json';

export const {module}Routes = new Hono();

let {module}s = [...seedData];

// GET list
{module}Routes.get('/', (c) => {
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 10;
  const start = (page - 1) * limit;
  const end = start + limit;

  return c.json({
    success: true,
    data: {
      list: {module}s.slice(start, end),
      total: {module}s.length,
      page,
      limit
    }
  });
});

// GET by id
{module}Routes.get('/:id', (c) => {
  const id = c.req.param('id');
  const item = {module}s.find(i => i.id === parseInt(id));

  if (!item) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: '{Module} not found' }
    }, 404);
  }

  return c.json({ success: true, data: item });
});

// POST create
{module}Routes.post('/', async (c) => {
  const body = await c.req.json();

  // Validation
  if (!body.name) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required' }
    }, 400);
  }

  const newItem = {
    id: Math.floor(Math.random() * 10000),
    ...body,
    createdAt: new Date().toISOString()
  };

  {module}s.push(newItem);

  return c.json({ success: true, data: newItem }, 201);
});

// PUT update
{module}Routes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const index = {module}s.findIndex(i => i.id === parseInt(id));

  if (index === -1) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: '{Module} not found' }
    }, 404);
  }

  {module}s[index] = { ...{module}s[index], ...body };

  return c.json({ success: true, data: {module}s[index] });
});

// DELETE (soft delete)
{module}Routes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const index = {module}s.findIndex(i => i.id === parseInt(id));

  if (index === -1) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: '{Module} not found' }
    }, 404);
  }

  {module}s[index].deletedAt = new Date().toISOString();

  return c.json({ success: true, data: { deleted: true } });
});
```

---

# Stage 4: Seed Data Generation

```json
// mocks/data/users.json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin",
    "organizationId": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "deletedAt": null
  },
  {
    "id": 2,
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user",
    "organizationId": 1,
    "createdAt": "2024-01-02T00:00:00Z",
    "updatedAt": "2024-01-02T00:00:00Z",
    "deletedAt": null
  }
]
```

---

# Stage 5: Configuration

## Package.json Dependencies

```json
{
  "scripts": {
    "mock": "tsx mocks/server.ts",
    "mock:watch": "tsx watch mocks/server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17"
  }
}
```

## Startup Instructions

```markdown
## Mock Server 启动

1. 安装依赖:
   npm install

2. 启动Mock服务器:
   npm run mock

3. 前端配置:
   修改前端 `.env` 文件:
   ```
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

4. 使用Mock用户登录:
   - Email: admin@example.com
   - Password: password
```

---

# Mock Server Features

| Feature | Implementation | Usage |
|---------|---------------|-------|
| Network latency | Random 100-500ms delay | Test loading states |
| Error simulation | Configurable error responses | Test error handling |
| Auth simulation | Bearer token middleware | Test protected routes |
| Persistence | In-memory storage | Data survives restart |
| Seed data | JSON files | Realistic test data |

---

# Constraints

**MUST DO:**
- Match api-contract.yaml exactly
- Include realistic seed data
- Simulate network latency
- Handle all error cases

**MUST NOT DO:**
- Add non-contract endpoints
- Return inconsistent data formats
- Skip soft delete handling
- Hardcode production URLs

---

# Gotchas

- **Port conflict** — Default mock port 3001; change if conflicts
- **CORS required** — Mock server must enable CORS for browser access
- **Latency is intentional** — Don't remove delay; it helps frontend test loading states
- **Data is ephemeral** — Mock data resets on server restart; use for dev only
- **Token has no real validation** — Any "Bearer mock-token" works for protected routes
---
name: kf-mvp-auth-implementation
description: >-
  Load when user asks to implement authentication, JWT tokens, or authorization
  for MVP projects. Triggers: 认证, authorization, JWT, 登录, auth实现, token,
  authentication, 权限. NOT for: OAuth/SSO integration, SAML, or enterprise
  identity provider setup.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-security
      type: conditional
    - target: all-in-mvp
      type: semantic
---

# MVP Auth Implementation — 认证实现技能

> **Core Belief**: Authentication is the gatekeeper of your system. A single flaw can compromise everything. Every implementation detail matters. Don't roll your own crypto.

**Division of Labor**: This Skill focuses on **authentication and authorization implementation** using Tool Wrapper pattern. Provides JWT patterns, session management, and RBAC implementation.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Framework: Hono (JWT via `hono/jwt`)
- Password: bcryptjs (NOT argon2 — keep dependencies minimal for MVP)
- Database: SQLite (user table in Drizzle schema)
- Token storage: localStorage (frontend) + Authorization header

Load `references/mvp-tech-stack-default.md` for full specification.

**MVP Auth Scope**: JWT stateless auth only. No refresh tokens, no OAuth, no SSO. RBAC only if PRD specifies multi-role permissions.

---

# Auth Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Login Request (email + password)             │   │
│  │ 2. Store Token (localStorage/Session)            │   │
│  │ 3. Attach Token (Authorization header)           │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────┐
│                      Backend                              │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Middleware Layer                                  │    │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐   │    │
│  │  │ CORS       │  │ Auth       │  │ Rate Limit│   │    │
│  │  └────────────┘  └────────────┘  └───────────┘   │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Auth Routes                                      │    │
│  │  POST /api/auth/login                             │    │
│  │  POST /api/auth/register                         │    │
│  │  POST /api/auth/logout                           │    │
│  │  GET  /api/auth/me                               │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

# JWT Implementation

## JWT Service

```typescript
// src/modules/auth/jwt.ts
import { Sign, Verify } from 'hono/jwt';
import { JWTPayload } from 'hono/types';

interface UserPayload extends JWTPayload {
  sub: number;     // user id
  email: string;
  role: string;
  exp?: number;
}

export async function createToken(user: User): Promise<string> {
  const payload: UserPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };
  
  return Sign(payload, env.JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    return await Verify(token, env.JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}
```

## Auth Middleware

```typescript
// src/modules/auth/middleware.ts
import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';

export async function authMiddleware(c: Context, next: Next) {
  // Get token from header or cookie
  const token = 
    c.req.header('Authorization')?.replace('Bearer ', '') ||
    getCookie(c, 'token');
  
  if (!token) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    }, 401);
  }
  
  const payload = await verifyToken(token);
  
  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
    }, 401);
  }
  
  // Attach user to context
  c.set('user', {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  });
  
  await next();
}

// Role-based middleware
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, 401);
    }
    
    if (!roles.includes(user.role)) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Permission denied' }
      }, 403);
    }
    
    await next();
  };
}
```

---

# Login Flow

```typescript
// src/modules/auth/routes.ts
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  
  // Find user
  const user = await db.select().from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  if (!user[0]) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    }, 401);
  }
  
  // Verify password
  const valid = await verifyPassword(user[0].passwordHash, password);
  
  if (!valid) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    }, 401);
  }
  
  // Create token
  const token = await createToken(user[0]);
  
  // Set cookie (optional)
  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  
  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        role: user[0].role,
      }
    }
  });
});

authRoutes.post('/logout', async (c) => {
  deleteCookie(c, 'token');
  return c.json({ success: true });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    data: user
  });
});
```

---

# Password Security

```typescript
// src/modules/auth/password.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10); // 10 rounds, sufficient for MVP
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Password validation
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain an uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain a lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain a number' };
  }
  return { valid: true };
}
```

---

# Role-Based Access Control

```typescript
// src/modules/auth/rbac.ts

// Role hierarchy
const roleHierarchy = {
  admin: ['admin', 'manager', 'user'],
  manager: ['manager', 'user'],
  user: ['user'],
};

export function hasPermission(userRole: string, requiredRole: string): boolean {
  const userRoles = roleHierarchy[userRole] || [];
  return userRoles.includes(requiredRole);
}

// Resource ownership check
export function isOwner(userId: number, resourceUserId: number): boolean {
  return userId === resourceUserId;
}

// Middleware for resource ownership
export function requireOwnership(getResourceUserId: (id: number) => Promise<number>) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const resourceId = parseInt(c.req.param('id'));
    
    if (isNaN(resourceId)) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400);
    }
    
    const resourceUserId = await getResourceUserId(resourceId);
    
    if (!isOwner(user.id, resourceUserId) && user.role !== 'admin') {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own this resource' }
      }, 403);
    }
    
    await next();
  };
}
```

---

# Data-Level Permission Testing (MUST — 迭代4核心修复)

**问题**：ERP系统有复杂的数据权限（行级/列级），不同角色/部门/组织只能看到部分数据。之前数据权限bug只在人工测试时发现（如：普通用户看到了其他部门的数据）。

**解决方案**：MUST 编写 **数据权限测试**，覆盖行级过滤 + 列级脱敏 + 跨组织隔离。

## 数据权限测试模板

```typescript
// src/modules/auth/permission.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware, requireRole } from './middleware';
import { getDataPermissionFilter, applyColumnMasking } from './data-permission';

describe('Data Permission — ERP Row/Column Level', () => {
  // 行级权限测试：不同角色/部门看到不同数据
  describe('Row-Level Filtering', () => {
    it('user should ONLY see data in their organization', async () => {
      const user = { id: 1, role: 'user', orgId: 100 };
      const filter = getDataPermissionFilter(user, 'orders');
      
      // MUST: WHERE organization_id = 100
      expect(filter).toEqual({ organizationId: 100 });
      
      // 验证查询结果不包含其他组织数据
      const results = await db.select().from(orders).where(eq(orders.organizationId, user.orgId));
      const otherOrgData = results.filter(r => r.organizationId !== user.orgId);
      expect(otherOrgData).toEqual([]); // MUST 为空
    });

    it('manager should see data in their org AND sub-orgs', async () => {
      const user = { id: 2, role: 'manager', orgId: 100, subOrgIds: [100, 101, 102] };
      const filter = getDataPermissionFilter(user, 'orders');
      
      // MUST: WHERE organization_id IN (100, 101, 102)
      expect(filter).toEqual({ organizationId: { in: [100, 101, 102] } });
    });

    it('admin should see ALL data (no filter)', async () => {
      const user = { id: 3, role: 'admin', orgId: 100 };
      const filter = getDataPermissionFilter(user, 'orders');
      
      // MUST: no filter applied
      expect(filter).toBeNull();
    });
  });

  // 列级权限测试：敏感字段脱敏
  describe('Column-Level Masking', () => {
    it('user should NOT see salary column', async () => {
      const user = { id: 1, role: 'user' };
      const rawData = { id: 1, name: 'John', salary: 50000, ssn: '123-45-6789' };
      const masked = applyColumnMasking(rawData, 'employees', user.role);
      
      expect(masked.salary).toBe('****'); // MUST 脱敏
      expect(masked.ssn).toBe('****');     // MUST 脱敏
      expect(masked.name).toBe('John');    // 非敏感字段正常
    });

    it('manager should see salary but NOT ssn', async () => {
      const user = { id: 2, role: 'manager' };
      const rawData = { id: 1, name: 'John', salary: 50000, ssn: '123-45-6789' };
      const masked = applyColumnMasking(rawData, 'employees', user.role);
      
      expect(masked.salary).toBe(50000);   // manager可见
      expect(masked.ssn).toBe('****');     // MUST 脱敏
    });

    it('admin should see ALL columns', async () => {
      const user = { id: 3, role: 'admin' };
      const rawData = { id: 1, name: 'John', salary: 50000, ssn: '123-45-6789' };
      const masked = applyColumnMasking(rawData, 'employees', user.role);
      
      expect(masked).toEqual(rawData); // 完全无脱敏
    });
  });

  // 跨组织隔离测试：MUST 阻断
  describe('Cross-Organization Isolation (MUST block)', () => {
    it('should 403 when user accesses other org resource by ID', async () => {
      const app = new Hono();
      app.get('/api/orders/:id', authMiddleware, async (c) => {
        const user = c.get('user');
        const orderId = parseInt(c.req.param('id'));
        const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        
        if (!order[0]) return c.json({ error: 'Not found' }, 404);
        
        // MUST: 检查数据权限
        if (order[0].organizationId !== user.orgId && user.role !== 'admin') {
          return c.json({ error: { code: 'FORBIDDEN' } }, 403);
        }
        
        return c.json({ data: order[0] });
      });

      // 用户属于 org 100，尝试访问 org 200 的数据
      const token = await getTestToken({ role: 'user', orgId: 100 });
      const res = await app.request('/api/orders/999', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      expect(res.status).toBe(403); // MUST 被阻断
    });

    it('should NOT leak data through list endpoint with crafted params', async () => {
      // 测试通过构造参数绕过过滤
      const token = await getTestToken({ role: 'user', orgId: 100 });
      
      // 尝试通过 query param 指定 orgId
      const res = await app.request('/api/orders?organizationId=200', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      const otherOrgItems = data.data.filter((o: any) => o.organizationId !== 100);
      expect(otherOrgItems).toEqual([]); // MUST 无法绕过
    });
  });

  // API 级别权限测试
  describe('API-Level Permission Matrix', () => {
    const testCases = [
      { role: 'user', endpoint: 'GET /api/orders', expected: 200 },
      { role: 'user', endpoint: 'DELETE /api/orders/1', expected: 403 },
      { role: 'manager', endpoint: 'DELETE /api/orders/1', expected: 200 },
      { role: 'user', endpoint: 'GET /api/reports/salary', expected: 403 },
      { role: 'admin', endpoint: 'GET /api/reports/salary', expected: 200 },
    ];

    it.each(testCases)('$role on $endpoint should return $expected', async ({ role, endpoint, expected }) => {
      const token = await getTestToken({ role });
      const [method, path] = endpoint.split(' ');
      const res = await app.request(path, { method, headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(expected);
    });
  });
});
```

## 数据权限实现模板

```typescript
// src/modules/auth/data-permission.ts

interface DataPermissionConfig {
  table: string;
  rowFilter: (user: UserContext) => SQL | null;
  columnMask: Record<string, string[]>; // role -> masked columns
}

const permissionConfig: Record<string, DataPermissionConfig> = {
  orders: {
    table: 'orders',
    rowFilter: (user) => {
      if (user.role === 'admin') return null;
      if (user.role === 'manager') {
        return inArray(orders.organizationId, user.subOrgIds || [user.orgId]);
      }
      return eq(orders.organizationId, user.orgId);
    },
    columnMask: {
      user: ['costPrice', 'supplierInfo'],
      manager: ['supplierInfo'],
      admin: [],
    },
  },
  employees: {
    table: 'employees',
    rowFilter: (user) => {
      if (user.role === 'admin') return null;
      return eq(employees.organizationId, user.orgId);
    },
    columnMask: {
      user: ['salary', 'ssn', 'bankAccount'],
      manager: ['ssn', 'bankAccount'],
      admin: [],
    },
  },
};

export function getDataPermissionFilter(user: UserContext, table: string): any {
  const config = permissionConfig[table];
  if (!config) return null;
  return config.rowFilter(user);
}

export function applyColumnMasking(data: any, table: string, role: string): any {
  const config = permissionConfig[table];
  if (!config) return data;
  
  const maskedColumns = config.columnMask[role] || [];
  const result = { ...data };
  
  for (const col of maskedColumns) {
    if (col in result) result[col] = '****';
  }
  
  return result;
}
```

## 数据权限测试覆盖率要求

| 测试类型 | 最低数量 | 说明 |
|---------|---------|------|
| 行级过滤 | 每个角色 × 每个表 | 不同角色对同一表的数据范围 |
| 列级脱敏 | 每个敏感字段 × 每个角色 | 敏感字段对不同角色的可见性 |
| 跨组织隔离 | 每个API端点 | 通过ID直接访问其他组织数据 |
| 绕过尝试 | 每个过滤点 | query param、body、header注入 |
| API权限矩阵 | 每个端点 × 每个角色 | 完整的权限矩阵验证 |

---

# Constraints

**MUST DO:**
- Use strong password hashing (argon2)
- Set appropriate token expiration
- Validate all auth inputs
- Log auth failures

**MUST NOT DO:**
- Store passwords in plain text
- Use weak JWT secrets
- Skip auth on protected routes
- Expose user data in token

---

# Gotchas

- **Token storage** — httpOnly cookies more secure than localStorage
- **Password hashing** — Never implement your own
- **Token expiration** — Short enough to limit damage, long enough to not annoy
- **Refresh tokens** — Consider for long sessions
- **Logout** — Implement token blacklisting or short expiry
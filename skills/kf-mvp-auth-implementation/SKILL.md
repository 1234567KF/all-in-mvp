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
---
name: kf-mvp-security
description: >-
  Load when user asks for security review, vulnerability scan, or security best
  practices. Triggers: 安全审查, 漏洞扫描, 安全最佳实践, security review,
  vulnerability scan, OWASP, authentication, authorization. Also load when
  implementing auth or handling sensitive data.
metadata:
  pattern: reviewer + tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
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


# MVP Security Specialist — 安全技能

> **Core Belief**: Security is not an afterthought. MVP doesn't mean insecure. Build secure from day one, add layers as needed.

**Division of Labor**: This Skill focuses on **security review and best practices** using Reviewer pattern with scoring criteria and Tool Wrapper for implementation guidance.

---

# Core Philosophy

1. **Defense in depth** — Multiple layers of security
2. **Least privilege** — Only grant necessary permissions
3. **Fail securely** — Default to denying access
4. **Validate all input** — Trust nothing from the client

---

# Security Checklist

## Authentication

| Check | Status | Notes |
|-------|--------|-------|
| Passwords hashed (bcrypt/argon2) | | |
| Password minimum length (8+) | | |
| Account lockout after N failed attempts | | |
| JWT tokens expire | | |
| Tokens can be revoked | | |

## Authorization

| Check | Status | Notes |
|-------|--------|-------|
| RBAC implemented | | |
| Permission checks on all protected routes | | |
| Admin routes restricted | | |
| Resource ownership verified | | |

## Input Validation

| Check | Status | Notes |
|-------|--------|-------|
| All input validated server-side | | |
| SQL injection prevented (parametrized) | | |
| XSS prevented (output encoding) | | |
| CSRF tokens on state-changing ops | | |

## Data Protection

| Check | Status | Notes |
|-------|--------|-------|
| Sensitive data not logged | | |
| Secrets in env vars, not code | | |
| Database connections encrypted | | |
| HTTPS enforced | | |

---

# Auth Implementation Pattern

## JWT Middleware

```typescript
import { Context, Next } from 'hono';
import { jwt } from 'hono/jwt';

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }
  
  try {
    const payload = await jwt.verify(token, env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }
};
```

## Role-Based Access Control

```typescript
export const requireRole = (...roles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user || !roles.includes(user.role)) {
      return c.json({ success: false, error: { code: 'FORBIDDEN' } }, 403);
    }
    
    await next();
  };
};

// Usage
app.use('/api/admin/*', authMiddleware);
app.use('/api/admin/*', requireRole('admin'));
```

## Password Hashing

```typescript
import { hash, verify } from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password);
}
```

---

# Input Validation Pattern

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[a-z]/, 'Password must contain lowercase')
    .regex(/[0-9]/, 'Password must contain number'),
  name: z.string().min(1).max(100).optional(),
});

export const validateRequest = (schema: z.ZodSchema) => {
  return async (c: Context, next: Next) => {
    const body = await c.req.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: result.error.flatten(),
        },
      }, 400);
    }
    
    c.set('body', result.data);
    await next();
  };
};
```

---

# SQL Injection Prevention

```typescript
// GOOD - Parameterized query
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email)); // Safe!

// BAD - String concatenation
const query = `SELECT * FROM users WHERE email = '${email}'`; // VULNERABLE!
```

---

# XSS Prevention

```typescript
// In frontend - use framework's built-in escaping
// Vue/React automatically escape HTML in expressions

// BAD - Direct HTML injection
element.innerHTML = userInput; // VULNERABLE!

// GOOD - Use textContent or framework escaping
element.textContent = userInput; // Safe!
```

---

# Security Review Report Template

```markdown
# Security Review Report

**Module**: [module]
**Date**: [date]
**Reviewer**: kf-mvp-security

## Authentication ✓/✗
[issues]

## Authorization ✓/✗
[issues]

## Input Validation ✓/✗
[issues]

## Data Protection ✓/✗
[issues]

## Overall Risk
[LOW/MEDIUM/HIGH/CRITICAL]

## Recommendations
[prioritized list]
```

---

# Constraints

**MUST DO:**
- Hash passwords with strong algorithms
- Validate all input server-side
- Use parameterized queries
- Implement proper auth checks

**MUST NOT DO:**
- Store passwords in plain text
- Trust client-side validation
- Concatenate SQL strings
- Expose internal errors to clients

---

# Gotchas

- **JWT secret** — Must be long and random, stored in env var
- **Password reset** — Use secure token with expiration
- **Rate limiting** — Prevent brute force on auth endpoints
- **Logging** — Never log passwords or tokens
- **CORS** — Whitelist specific origins, don't use *
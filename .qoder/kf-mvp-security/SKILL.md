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

# Security Testing (MUST — 迭代13核心修复)

**问题**：营销系统（优惠券、抽奖、红包）经常被恶意刷取，之前安全漏洞只在人工测试时发现（如：同一IP重复领取、伪造请求绕过限制）。

**解决方案**：MUST 编写 **安全测试**，覆盖防刷、限流、输入净化、越权访问。

## 防刷与限流测试模板

```typescript
// src/modules/coupon/coupon.security.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '@/middleware/rate-limit';

describe('Marketing Security — Anti-Fraud & Rate Limiting', () => {
  // 测试1：IP限流
  it('should block requests exceeding rate limit', async () => {
    const app = new Hono();
    app.use('/api/coupons/claim', rateLimit({ windowMs: 60000, max: 5 }));
    app.post('/api/coupons/claim', async (c) => {
      return c.json({ success: true });
    });

    // 同一IP快速请求6次
    const promises = Array.from({ length: 6 }, () =>
      app.request('/api/coupons/claim', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '192.168.1.1' }
      })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    const blockedCount = results.filter(r => r.status === 429).length;

    expect(successCount).toBe(5); // 只允许5次
    expect(blockedCount).toBe(1); // 第6次被阻断
  });

  // 测试2：同一用户重复领取
  it('should prevent duplicate claim from same user', async () => {
    const app = buildApp();
    const token = await getTestToken({ userId: 1 });

    // 第一次领取
    const first = await app.request('/api/coupons/claim', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ couponId: 1 })
    });
    expect(first.status).toBe(200);

    // 第二次领取同一优惠券
    const second = await app.request('/api/coupons/claim', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ couponId: 1 })
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('ALREADY_CLAIMED');
  });

  // 测试3：SQL注入防护
  it('should sanitize SQL injection attempts', async () => {
    const app = buildApp();
    const token = await getTestToken();

    const maliciousInput = "'; DROP TABLE users; --";
    const res = await app.request('/api/products/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: maliciousInput })
    });

    // MUST：不报错（不是500），正常返回空结果或过滤后的结果
    expect(res.status).not.toBe(500);
    
    // 验证users表仍然存在
    const usersRes = await app.request('/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(usersRes.status).toBe(200);
  });

  // 测试4：XSS防护
  it('should sanitize XSS payload in output', async () => {
    const app = buildApp();
    const token = await getTestToken();

    const xssPayload = '<script>alert("xss")</script>';
    
    // 创建包含XSS的数据
    await app.request('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: xssPayload, price: 100 })
    });

    // 获取数据
    const res = await app.request('/api/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    // MUST：XSS被转义，不包含原始script标签
    const product = data.data.find((p: any) => p.name.includes('script'));
    if (product) {
      expect(product.name).not.toContain('<script>');
      expect(product.name).toContain('&lt;script&gt;'); // 或被完全过滤
    }
  });

  // 测试5：越权访问
  it('should prevent horizontal privilege escalation', async () => {
    const app = buildApp();
    const userAToken = await getTestToken({ userId: 1, role: 'user' });
    const userBToken = await getTestToken({ userId: 2, role: 'user' });

    // 用户A创建订单
    const order = await app.request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ items: [{ productId: 1, qty: 1 }] })
    });
    const orderData = await order.json();

    // 用户B尝试访问用户A的订单
    const res = await app.request(`/api/orders/${orderData.data.id}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });

    expect(res.status).toBe(403);
  });

  // 测试6：CSRF防护
  it('should reject requests without CSRF token', async () => {
    const app = buildApp();
    
    // 无CSRF token的请求
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: { 
        Authorization: 'Bearer test-token',
        // 缺少 X-CSRF-Token
      },
      body: JSON.stringify({ items: [] })
    });

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_TOKEN_MISSING');
  });
});
```

## 安全测试覆盖率要求

| 测试类型 | 最低数量 | 说明 |
|---------|---------|------|
| 限流 | 每个敏感端点 | IP/用户级别请求频率限制 |
| 防重放 | 每个领取/抽奖操作 | 同一资源只能操作一次 |
| SQL注入 | 每个查询接口 | 恶意输入不破坏数据 |
| XSS | 每个文本输出 | 恶意脚本被转义/过滤 |
| 越权 | 每个资源端点 | 不能访问其他用户数据 |
| CSRF | 每个状态变更端点 | 必须携带有效CSRF token |

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
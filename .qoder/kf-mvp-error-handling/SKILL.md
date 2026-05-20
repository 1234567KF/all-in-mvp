---
name: kf-mvp-error-handling
description: >-
  Load when user asks for error handling patterns, error response design, or
  exception management. Triggers: 错误处理, 异常处理, error handling,
  exception, 错误响应, error response, error codes. Also load when
  implementing API error handling.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
recommended_model: pro
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


# MVP Error Handling — 错误处理技能

> **Core Belief**: Errors are part of the API contract. How you communicate errors determines how quickly clients can recover. Design errors like you design success responses.

**Division of Labor**: This Skill focuses on **error handling patterns** using Tool Wrapper pattern. Provides error class definitions, response formatting, and exception management.

---

# Core Philosophy

1. **Consistent format** — Same error structure everywhere
2. **Actionable messages** — Tell clients what to do
3. **Never expose internals** — Sanitize error messages
4. **Log context** — Log errors with request context

---

# Error Response Format

```typescript
// Standard error response envelope
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable code
    message: string;        // Human-readable message
    details?: any;          // Additional context (optional)
  };
}

// Examples:
// Validation error with details
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details: {
      fields: {
        email: 'Invalid email format',
        password: 'Must be at least 8 characters'
      }
    }
  }
}

// Not found error
{
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'User not found'
  }
}
```

---

# Error Code Registry

| Code | HTTP | Description | Client Action |
|------|------|-------------|---------------|
| VALIDATION_ERROR | 400 | Input validation failed | Fix input |
| BAD_REQUEST | 400 | Malformed request | Check request format |
| UNAUTHORIZED | 401 | Authentication required | Login |
| INVALID_TOKEN | 401 | Token invalid/expired | Re-authenticate |
| FORBIDDEN | 403 | Permission denied | Contact admin |
| NOT_FOUND | 404 | Resource not found | Check ID |
| ALREADY_EXISTS | 409 | Duplicate resource | Use existing |
| CONFLICT | 409 | State conflict | Refresh and retry |
| RATE_LIMITED | 429 | Too many requests | Wait and retry |
| INTERNAL_ERROR | 500 | Server error | Contact support |

---

# Error Class Hierarchy

```typescript
// src/errors/index.ts

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}
```

---

# Global Error Handler

```typescript
// src/middleware/error.ts
import { Context, Next } from 'hono';
import { AppError } from '../errors';

export const errorMiddleware = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    // Log error with context
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: c.req.path,
      method: c.req.method,
      requestId: c.get('requestId'),
    }, 'Unhandled error');

    // Handle known errors
    if (error instanceof AppError) {
      return c.json({
        success: false,
        error: {
          code: error.code,
          message: error.httpStatus >= 500 
            ? 'An error occurred' 
            : error.message,
          details: error.details,
        },
      }, error.httpStatus);
    }

    // Handle unknown errors
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred',
      },
    }, 500);
  }
};
```

---

# Service Layer Error Handling

```typescript
// src/modules/users/service.ts
export class UserService {
  async findById(id: number): Promise<User> {
    const user = await db.select().from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    if (!user[0]) {
      throw new NotFoundError('User');
    }
    
    return user[0];
  }

  async create(data: CreateUserDto): Promise<User> {
    // Check for existing email
    const existing = await db.select()
      .from(users)
      .where(eq(users.email, data.email));
    
    if (existing[0]) {
      throw new ConflictError('User with this email already exists');
    }
    
    // Create user
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }
}
```

---

# Client-Side Error Handling

```typescript
// Frontend API wrapper
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  
  if (!data.success) {
    switch (data.error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        router.push('/login');
        throw new Error('Please login to continue');
        
      case 'FORBIDDEN':
        // Show permission error
        throw new Error('You do not have permission');
        
      case 'VALIDATION_ERROR':
        // Show field errors
        throw new ValidationError(data.error.message, data.error.details);
        
      case 'NOT_FOUND':
        throw new Error(data.error.message);
        
      default:
        throw new Error(data.error.message || 'An error occurred');
    }
  }
  
  return data.data;
}
```

---

# Error Recovery & Rollback Testing (MUST — 迭代11核心修复)

**问题**：ERP系统的复杂业务操作（转账、库存调整、订单处理）经常在部分失败后导致数据不一致，之前错误恢复只在人工测试时验证，自动化测试未覆盖回滚逻辑。

**解决方案**：MUST 编写 **错误恢复测试** 和 **事务回滚测试**，确保部分失败时数据一致性。

## 事务回滚测试模板

```typescript
// src/modules/transfer/transfer.rollback.test.ts
import { describe, it, expect } from 'vitest';
import { getTestDb } from '@/tests/helpers';
import { getTransferService } from './service';

describe('ERP Transfer — Error Recovery & Rollback', () => {
  it('should rollback both accounts on transfer failure', async () => {
    const db = getTestDb();
    const service = getTransferService(db);
    
    // 初始化：账户A有1000，账户B有500
    await db.insert(accounts).values([
      { id: 1, balance: 1000 },
      { id: 2, balance: 500 },
    ]);
    
    // 模拟转账过程中断（如：第二步失败）
    const mockDb = {
      ...db,
      transaction: async (fn: any) => {
        await fn(db); // 执行第一步
        throw new Error('Simulated network error'); // 第二步失败
      }
    };
    
    const failingService = getTransferService(mockDb as any);
    
    await expect(failingService.transfer(1, 2, 200))
      .rejects.toThrow('network error');
    
    // MUST：回滚后余额不变
    const [accA, accB] = await db.select().from(accounts);
    expect(accA.balance).toBe(1000);
    expect(accB.balance).toBe(500);
  });

  it('should handle partial inventory adjustment rollback', async () => {
    const db = getTestDb();
    
    // 初始化：仓库A有100件，仓库B有50件
    await db.insert(inventory).values([
      { id: 1, warehouse: 'A', productId: 1, quantity: 100 },
      { id: 2, warehouse: 'B', productId: 1, quantity: 50 },
    ]);
    
    try {
      await db.transaction(async (tx) => {
        // 第一步：从A出库30件
        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - 30` })
          .where(eq(inventory.id, 1));
        
        // 第二步：向B入库30件（模拟失败）
        throw new Error('Warehouse B is locked');
      });
    } catch (e) {
      // expected
    }
    
    // MUST：A仓库数量回滚到100
    const whA = await db.select().from(inventory).where(eq(inventory.id, 1)).limit(1);
    expect(whA[0].quantity).toBe(100);
  });

  it('should maintain order-item consistency on failure', async () => {
    const db = getTestDb();
    
    // 创建订单（包含2个商品）
    const order = await db.insert(orders).values({ 
      customerId: 1, 
      status: 'PENDING',
      total: 300 
    }).returning();
    
    try {
      await db.transaction(async (tx) => {
        // 创建订单项1
        await tx.insert(orderItems).values({ 
          orderId: order[0].id, 
          productId: 1, 
          quantity: 2, 
          price: 100 
        });
        
        // 创建订单项2（模拟失败）
        throw new Error('Product 2 out of stock');
      });
    } catch (e) {
      // expected
    }
    
    // MUST：订单项未创建（事务回滚）
    const items = await db.select().from(orderItems)
      .where(eq(orderItems.orderId, order[0].id));
    expect(items).toHaveLength(0);
    
    // MUST：订单状态仍为PENDING
    const updatedOrder = await db.select().from(orders)
      .where(eq(orders.id, order[0].id)).limit(1);
    expect(updatedOrder[0].status).toBe('PENDING');
  });
});
```

## 错误恢复测试模板

```typescript
// src/modules/order/order.recovery.test.ts
import { describe, it, expect } from 'vitest';

describe('Error Recovery Patterns', () => {
  it('should retry on transient failure', async () => {
    let attempts = 0;
    const flakyService = {
      process: async () => {
        attempts++;
        if (attempts < 3) throw new Error('Transient error');
        return { success: true };
      }
    };
    
    const result = await withRetry(() => flakyService.process(), { maxRetries: 3 });
    
    expect(attempts).toBe(3);
    expect(result.success).toBe(true);
  });

  it('should fail after max retries', async () => {
    const alwaysFail = {
      process: async () => { throw new Error('Persistent error'); }
    };
    
    await expect(
      withRetry(() => alwaysFail.process(), { maxRetries: 3 })
    ).rejects.toThrow('Persistent error');
  });

  it('should use circuit breaker after repeated failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, timeout: 5000 });
    
    // 连续失败3次
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(() => { throw new Error('Fail'); }); } catch (e) {}
    }
    
    // 第4次：断路器打开，直接拒绝
    await expect(breaker.execute(() => Promise.resolve({})))
      .rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should recover after circuit breaker cooldown', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, timeout: 100 });
    
    // 触发断路
    try { await breaker.execute(() => { throw new Error('Fail'); }); } catch (e) {}
    try { await breaker.execute(() => { throw new Error('Fail'); }); } catch (e) {}
    
    // 等待冷却
    await new Promise(r => setTimeout(r, 150));
    
    // 恢复后应该可以执行
    const result = await breaker.execute(() => Promise.resolve({ success: true }));
    expect(result.success).toBe(true);
  });
});
```

## 错误恢复与回滚测试覆盖率要求

| 测试类型 | 最低数量 | 说明 |
|---------|---------|------|
| 事务回滚 | 每个多步骤操作 | 部分失败后数据一致性 |
| 重试机制 | 每个外部调用 | 瞬态错误恢复 |
| 断路器 | 每个关键服务 | 防止级联故障 |
| 补偿事务 | 每个 Saga 流程 | 长事务的补偿操作 |
| 死信队列 | 每个异步处理 | 失败消息的处理 |

# Constraints

**MUST DO:**
- Use consistent error format
- Log errors with context
- Sanitize error messages for clients
- Handle all error cases in services

**MUST NOT DO:**
- Expose stack traces to clients
- Use generic error messages
- Skip error handling in services
- Log sensitive data in errors

---

# Gotchas

- **Error codes** — Use machine-readable codes, not just messages
- **HTTP status** — Match status to error type
- **Details** — Only include for validation errors
- **Logging** — Log full error server-side, sanitize client-side
- **Retry logic** — Handle 429 (rate limit) and 5xx (temporary) differently
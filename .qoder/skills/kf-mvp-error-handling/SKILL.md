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
---
name: kf-mvp-api-contract
description: >-
  Load when user asks to design, generate, or review API contracts, DTOs,
  or error codes for MVP projects. Triggers: API契约, DTO设计, 接口设计,
  error codes, request/response, api contract, openapi. NOT for: production
  API gateway design, GraphQL schema design, or microservices contract.
metadata:
  pattern: tool-wrapper + reviewer
  domain: mvp-stage2
recommended_model: deepseek-v4-pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

# MVP API Contract Designer �?API契约设计技�?

> **Core Belief**: API contract is the single source of truth for frontend-backend synchronization. A well-designed contract enables parallel development without constant coordination.

**Division of Labor**: This Skill focuses on **API contract design** using Tool Wrapper pattern with best practices and Reviewer for validation.

**Default Tech Stack Context**:
- Backend framework: Hono (affects route design, middleware, validation)
- Validation: Zod (via `@hono/zod-validator`)
- Auth: JWT (Bearer token in Authorization header)
- Response format: `{ success: boolean, data?: T, error?: { code, message } }`

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Contract first** �?Define interfaces before implementation
2. **Consistency** �?Same patterns across all endpoints
3. **Completeness** �?All error cases documented
4. **Type safety** �?DTOs typed from day one

---

# API Design Principles

## RESTful Conventions

| Resource | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| /users | List | Create | Bulk update | - |
| /users/:id | Get | - | Update | Delete |

## Response Envelope

```typescript
// Success
{
  success: true,
  data: { /* payload */ }
}

// Error
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human readable message",
    details?: { /* optional */ }
  }
}
```

## Standard Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | VALIDATION_ERROR | Invalid input |
| 400 | BAD_REQUEST | Malformed request |
| 401 | UNAUTHORIZED | Not authenticated |
| 403 | FORBIDDEN | Not authorized |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Duplicate or state conflict |
| 422 | UNPROCESSABLE | Business rule violation |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

---

# DTO Design Patterns

## Create DTO

```typescript
interface CreateUserDto {
  email: string;           // required
  password: string;        // required
  name?: string;          // optional
  role?: UserRole;        // optional with default
}
```

## Update DTO

```typescript
interface UpdateUserDto {
  email?: string;         // all optional for partial update
  name?: string;
  role?: UserRole;
}
```

## Query DTO

```typescript
interface ListQueryDto {
  page?: number;           // pagination
  limit?: number;
  sort?: string;           // field to sort by
  order?: 'asc' | 'desc';
  search?: string;         // full-text search
  filter?: Record<string, any>; // advanced filters
}
```

## Response DTO

```typescript
interface UserResponseDto {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;      // ISO date string
  updatedAt: string;
}
```

---

# Mock-后端一致性验�?(MUST �?迭代2核心修复)

**问题**：之前前端用 Mock 开发，后端用真�?API，两者行为不一致导致联调时大量 bug�?

**解决方案**：API 契约设计完成后，MUST 生成 **一致性验证测�?*，确�?Mock 和真实后端行为完全一致�?

## 一致性验证清�?

| 验证�?| Mock | 真实后端 | 验证方式 |
|--------|------|---------|---------|
| 响应格式 | `{success, data/error}` | `{success, data/error}` | 结构对比 |
| HTTP状态码 | 200/201/400/401/404/409 | 相同 | 状态码对比 |
| Error Code | `INVALID_CREDENTIALS` | `INVALID_CREDENTIALS` | 字符串完全匹�?|
| 字段类型 | `id: number` | `id: number` | TypeScript类型检�?|
| 分页参数 | `page=1&limit=10` | `page=1&limit=10` | 默认值对�?|
| CORS�?| `Access-Control-Allow-Origin` | 相同 | 响应头对�?|
| 延迟范围 | 100-500ms | 真实网络 | 可配�?|

## 自动化验证脚�?

```typescript
// tests/contract-consistency.test.ts
import { describe, it, expect } from 'vitest';

const MOCK_URL = 'http://localhost:3001';
const REAL_URL = 'http://localhost:3000';

describe('API Contract Consistency', () => {
  const endpoints = [
    { method: 'GET', path: '/api/users', auth: true },
    { method: 'POST', path: '/api/users', auth: true, body: { name: 'test' } },
    { method: 'GET', path: '/api/users/1', auth: true },
  ];

  endpoints.forEach(({ method, path, auth, body }) => {
    it(`${method} ${path} should have consistent response format`, async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth) headers['Authorization'] = 'Bearer mock-token';

      const [mockRes, realRes] = await Promise.all([
        fetch(`${MOCK_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
        fetch(`${REAL_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
      ]);

      const mockJson = await mockRes.json();
      const realJson = await realRes.json();

      // 1. 响应结构必须一�?
      expect(mockJson).toHaveProperty('success');
      expect(realJson).toHaveProperty('success');

      // 2. Error 结构必须一�?
      if (!mockJson.success) {
        expect(mockJson.error).toHaveProperty('code');
        expect(mockJson.error).toHaveProperty('message');
        expect(realJson.error).toHaveProperty('code');
        expect(realJson.error).toHaveProperty('message');
        expect(mockJson.error.code).toBe(realJson.error.code); // MUST 完全匹配
      }

      // 3. HTTP 状态码必须一�?
      expect(mockRes.status).toBe(realRes.status);
    });
  });
});
```

---

# OpenAPI Specification

```yaml
# api-contract.yaml
openapi: 3.0.0
info:
  title: MVP API
  version: 1.0.0

paths:
  /api/users:
    get:
      summary: Get user list
      tags: [Users]
      security:
        - BearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      list:
                        type: array
                        items:
                          $ref: '#/components/schemas/User'
                      total:
                        type: integer
                      page:
                        type: integer
                      limit:
                        type: integer
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer

  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        email:
          type: string
        name:
          type: string
        role:
          type: string
          enum: [admin, user, brand]

  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    NotFound:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    Error:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
```

---

# API Contract Review Checklist

## Functional Review
- [ ] All CRUD operations defined
- [ ] All business operations defined
- [ ] All error cases documented
- [ ] Pagination implemented

## Security Review
- [ ] Auth requirements specified
- [ ] Permission levels defined
- [ ] Rate limiting documented

## Consistency Review
- [ ] Naming consistent (snake_case params)
- [ ] Response format consistent
- [ ] Error format consistent

## Completeness Review
- [ ] All DTOs typed
- [ ] All field validations specified
- [ ] All examples provided

---

# Constraints

**MUST DO:**
- Use response envelope consistently
- Document all error codes
- Type all DTOs
- Follow RESTful conventions

**MUST NOT DO:**
- Return different formats per endpoint
- Expose internal details in errors
- Skip auth requirements
- Use stringly-typed DTOs

---

# Gotchas

- **Envelope is law** �?Always wrap in { success, data/error }
- **ISO dates** �?Always use ISO 8601 date strings, not timestamps
- **Soft delete in list** �?GET should exclude deleted items
- **Partial update** �?PUT should accept partial data
- **Null vs undefined** �?Use null for "explicitly empty", undefined for "not provided"
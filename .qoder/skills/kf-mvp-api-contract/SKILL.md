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

# MVP API Contract Designer — API契约设计技能

> **Core Belief**: API contract is the single source of truth for frontend-backend synchronization. A well-designed contract enables parallel development without constant coordination.

**Division of Labor**: This Skill focuses on **API contract design** using Tool Wrapper pattern with best practices and Reviewer for validation.

**Default Tech Stack Context**:
- Backend framework: Hono (affects route design, middleware, validation)
- Validation: Zod (via `@hono/zod-validator`)
- Auth: JWT (Bearer token in Authorization header)
- Response format: `{ success: boolean, data?: T, error?: { code, message } }`

Load `.qoder/skills/references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Contract first** — Define interfaces before implementation
2. **Consistency** — Same patterns across all endpoints
3. **Completeness** — All error cases documented
4. **Type safety** — DTOs typed from day one

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

# 契约单源一致性验证 (MUST — v2.26 取代原「Mock-后端一致性验证」)

**原问题**：前端用 Mock 开发、后端用真实 API，两者行为不一致，联调时大量 bug。
**原解法的问题**：它把"两个真相源要对齐"当成前提，于是需要第三个东西去对不齐——一致性测试。
**v2.26 解法**：只留一个真相源，把"对齐"变成"同一份定义在两处被消费"，可校验面从 7 项对比降为 1 组断言。

真相源层级（裁决顺序自上而下）：

```
后端实际注册路由  =  packages/shared 的 Zod schema   ← 真源
        ↓ 派生
api-contract.yaml（文档视图，不参与判定，冲突时改它）
```

| 验证项 | 由谁保证 | 验证方式 |
|--------|---------|---------|
| 响应格式 `{success, data/error}` | 后端 `ok()/fail()` 唯一出口 | 后端路由测试逐条断言（R001） |
| HTTP 状态码 200/201/400/401/403/404/409/500 | service 抛 `ServiceError` → `mapServiceError` | 异常分支清单逐条真实请求（R035） |
| Error Code 字符串 | `packages/shared` 里的错误码常量 | 前端展示与后端返回同一常量，禁止字面量 |
| 字段名与类型 | Zod schema 单一来源，双端同 import | `typecheck` + service 层 `schema.parse` |
| 分页参数与默认值 | `packages/shared/pagination.ts` | 单测断言默认值，禁止双端各写一套 |
| 前端调用路径存在性 | 后端路由表 | `check-api-endpoints.ps1`（R014，孤端点即 FAIL） |
| CORS / 前缀 | Vite `/api` 代理 + Hono 挂载点 | E2E 必须穿透代理层（R003） |

## 自动化验证脚本

```typescript
// apps/api/src/modules/user/user.route.test.ts —— 对真实后端断言，不与 mock 比对
import { describe, it, expect, beforeEach } from "bun:test";

describe("契约单源：后端响应形状", () => {
  it("GET /users 未认证 → 401 + 结构化 error", async () => {
    const res = await app.request("/users");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ success: false, error: { code: expect.any(String), message: expect.any(String) } });
  });

  it("POST /users 字段非法 → 400 且逐字段 errors 与 shared schema 同源", async () => {
    const res = await app.request("/users", { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(Object.keys(json.error.errors ?? {})).toContain("email");
  });
});
```

```powershell
# 派生视图与前端调用点校验（Stage4 门禁，R014 / R016）
powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/check-api-endpoints.ps1
```

> **为什么不写"mock vs real"对比测试**：mock 的路径、字段、错误码都是按前端期望填的，
> 两边一致只能证明"前端是自洽的"，证不了后端存在这条路由。
> 真实事故：权威 starter 的改密功能 270 个 mock 单测全绿，`curl` 真实后端 404（血案 B028）。

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

- **Envelope is law** — Always wrap in { success, data/error }
- **ISO dates** — Always use ISO 8601 date strings, not timestamps
- **Soft delete in list** — GET should exclude deleted items
- **Partial update** — PUT should accept partial data
- **Null vs undefined** — Use null for "explicitly empty", undefined for "not provided"
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
recommended_model: pro
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

Load `references/mvp-tech-stack-default.md` for full specification.

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
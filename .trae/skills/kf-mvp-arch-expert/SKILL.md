---
name: kf-mvp-arch-expert
description: >-
  Load when user asks to create architecture spec, design database schema,
  or define API contracts. Triggers: 架构设计, spec, schema, 接口契约,
  数据库设计, API设计, 架构专家, 生成spec, 技术规格. Also load when
  PRD is ready and needs conversion to technical specifications.
metadata:
  pattern: generator + tool-wrapper
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-prd-generator
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Default: Node.js + Hono + Drizzle + SQLite + Vue 3 + Vite
- Unless user explicitly overrides, enforce this stack in all outputs

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Architecture Expert — 架构专家技能

> **Core Belief**: Schema and API contract are the ONLY synchronization point between frontend and backend. They must be rock-solid before any parallel development begins.

**Division of Labor**: This Skill focuses on **technical specification generation** based on PRD. It outputs spec.md, schema.sql, and api-contract.yaml. File engineering follows Generator pattern with strict templates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 2.1 — 架构专家:

1. **MVP fixed stack** — Hono + Drizzle + SQLite/Turso (unless explicitly specified otherwise)
2. **Schema is global** — One unified schema shared by all modules
3. **API contract is law** — Once locked, no changes without formal process
4. **Ignore non-functional requirements** — Performance, security are future iterations

---

# Output Artifacts

## Artifact 1: spec.md

Technical specification document defining:
- Technology stack
- Architecture overview
- Module organization
- Data flow
- Security considerations (basic only)

## Artifact 2: schema.sql (or Drizzle Schema)

Database schema defining:
- All tables with fields, types, constraints
- Relationships between tables
- Indexes and foreign keys
- Soft delete conventions

## Artifact 3: api-contract.yaml

API contract defining:
- All routes with methods
- Request/Response DTOs
- Error codes
- Authentication requirements

---

# Stage 1: Technology Stack Decision

**Ask if not specified**:
```
技术栈是什么？
- MVP标准栈: Hono + Drizzle + SQLite/Turso
- 或指定其他技术栈
```

**MUST use MVP standard stack unless user explicitly specifies otherwise.**

---

# Stage 2: Schema Design

## Schema Design Principles

1. **Analyze PRD ER section** — Extract entities and relationships
2. **Design global schema** — All modules share the same schema
3. **Follow naming conventions**:
   - Tables: `snake_case` plural (`users`, `products`, `trace_codes`)
   - Columns: `snake_case` (`user_id`, `created_at`)
   - Primary keys: `id` (integer auto-increment) or `uuid`
   - Foreign keys: `{table_singular}_id` (`user_id`, `product_id`)
4. **Soft delete convention** — Add `deleted_at TIMESTAMP NULL` for soft delete tables
5. **Audit fields** — Add `created_at`, `updated_at` to all tables

## Schema Output Template

```sql
-- [Project Name] Database Schema
-- Generated from PRD
-- DO NOT modify directly; changes require review

-- Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    organization_id INTEGER REFERENCES organizations(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);

-- Products Table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    organization_id INTEGER REFERENCES organizations(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

-- ... additional tables
```

## Drizzle Schema Alternative

```typescript
// schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  organizationId: integer('organization_id').references(() => organizations.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  deletedAt: text('deleted_at'),
});
```

---

# Stage 3: API Contract Design

## API Design Principles

1. **RESTful conventions**:
   - `GET /resources` — List
   - `GET /resources/:id` — Get one
   - `POST /resources` — Create
   - `PUT /resources/:id` — Update
   - `DELETE /resources/:id` — Delete (soft delete if applicable)

2. **Naming conventions**:
   - Routes: `/api/{resource}` or `/api/{resource}/{action}`
   - DTOs: PascalCase `{Resource}{Action}Dto` (`CreateUserDto`, `UpdateProductDto`)

3. **Response envelope**:
   ```json
   {
     "success": true,
     "data": { ... },
     "error": null
   }
   ```

4. **Error codes**:
   | Code | Meaning |
   |------|---------|
   | 400 | Bad Request — invalid input |
   | 401 | Unauthorized — not logged in |
   | 403 | Forbidden — no permission |
   | 404 | Not Found — resource doesn't exist |
   | 409 | Conflict — duplicate or state conflict |
   | 500 | Internal Error — server error |

## API Contract YAML Template

```yaml
# API Contract for [Project Name]
# Generated from PRD
# DO NOT modify directly; changes require review

openapi: 3.0.0
info:
  title: [Project API]
  version: 1.0.0

servers:
  - url: /api

paths:
  /auth/login:
    post:
      summary: 用户登录
      tags:
        - Auth
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: 登录成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /users:
    get:
      summary: 获取用户列表
      tags:
        - Users
      security:
        - BearerAuth: []
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer

  schemas:
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
        password:
          type: string

    LoginResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            token:
              type: string
            user:
              $ref: '#/components/schemas/User'

  responses:
    Unauthorized:
      description: 未授权
      content:
        application/json:
          schema:
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
                    example: UNAUTHORIZED
                  message:
                    type: string
                    example: Invalid credentials
```

---

# Stage 4: spec.md Template

```markdown
# [Project Name] Technical Specification

> **Version**: 1.0  
> **Based on PRD**: [PRD file path]  
> **Status**: DRAFT → LOCKED

---

## 1. 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js 18+ | |
| Web框架 | Hono | 轻量高性能 |
| ORM | Drizzle | 类型安全 |
| 数据库 | SQLite/Turso | MVP最优选择 |
| 前端 | Vue 3 + Vite | |

## 2. 架构概览

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│              Vue 3 + Composition API            │
└─────────────────────┬───────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────┐
│                   Backend                        │
│              Hono + Drizzle                     │
└─────────────────────┬───────────────────────────┘
                      │ SQL
┌─────────────────────▼───────────────────────────┐
│                   Database                       │
│              SQLite / Turso                     │
└─────────────────────────────────────────────────┘
```

## 3. 模块组织

```
src/
├── modules/
│   ├── auth/           # 认证与权限
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   └── types.ts
│   ├── users/         # 用户管理
│   ├── products/       # 产品管理
│   ├── trace/          # 溯源管理
│   └── template/       # 模板管理
├── schema.ts           # 全局Schema
└── index.ts           # 入口文件
```

## 4. 数据流

### 认证流程
1. 用户登录 → POST /api/auth/login
2. 服务端验证 → 返回JWT token
3. 后续请求携带Token → Authorization: Bearer {token}
4. 中间件验证Token → 解析用户信息

### 业务请求流程
1. 前端发送请求
2. 路由匹配 → 中间件处理（认证、日志）
3. Service处理业务逻辑
4. Schema操作数据库
5. 返回Response

## 5. 安全考虑

- 密码使用bcrypt哈希存储
- JWT token有过期时间
- SQL注入防护（Drizzle参数化查询）
- XSS防护（前端转义）

---

## 附录：变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0 | [日期] | 初始版本 | [作者] |
```

---

# Quality Checklist

Before final output, verify:

- [ ] All PRD entities have corresponding tables
- [ ] All PRD features have corresponding API endpoints
- [ ] All foreign key relationships are defined
- [ ] Soft delete convention applied where needed
- [ ] Audit fields (created_at, updated_at) added
- [ ] Error codes documented
- [ ] Authentication requirements specified

---

# Constraints

**MUST DO:**
- Use MVP standard stack unless explicitly told otherwise
- Create global schema, not per-module schemas
- Define all foreign key relationships
- Document soft delete convention
- Mark output as DRAFT until reviewed

**MUST NOT DO:**
- Add performance optimizations (future iteration)
- Add security hardening beyond basics
- Design for scale (MVP focus)
- Skip any entity from PRD

---

# Gotchas

- **Schema is global** — All modules share ONE schema.ts file, not separate files
- **Soft delete everywhere** — Unless specified, all business tables should support soft delete
- **Lock before parallel** — This output must pass grill-with-docs review before Stage3 begins
- **Foreign key order** — Tables with FK must be created after the tables they reference
- **Migration files** — Generate Drizzle migration files for production deployment
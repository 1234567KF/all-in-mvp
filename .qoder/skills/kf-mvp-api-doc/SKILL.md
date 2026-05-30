---
name: kf-mvp-api-doc
description: >-
  Load when user asks to generate API documentation, README, or developer
  documentation. Triggers: APIæ–‡æ¡£, å¼€å‘æ–‡æ¡? README, api doc, documentation,
  æ–‡æ¡£ç”Ÿæˆ, developer docs. Also load when publishing API or onboarding
  new developers.
metadata:
  pattern: generator
  domain: mvp-stage4
recommended_model: kimi-for-coding
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


# MVP API Documentation â€?APIæ–‡æ¡£ç”ŸæˆæŠ€èƒ?

> **Core Belief**: Good documentation is as important as the API itself. If developers can't figure out how to use it, the API fails. Document the why, not just the what.

**Division of Labor**: This Skill focuses on **API documentation generation** using Generator pattern. Creates comprehensive docs from api-contract.yaml and code.

---

# Core Philosophy

1. **Examples first** â€?Show, don't tell
2. **Complete coverage** â€?Every endpoint, every error
3. **Consistent format** â€?Same structure everywhere
4. **Actionable** â€?Developer can start coding after reading

---

# README Template

```markdown
# Project Name

> One-line description

## Quick Start

```bash
git clone https://github.com/org/project.git
cd project
npm install
npm run dev
```

## API Reference

### Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 1, "email": "admin@example.com" }
  }
}
```

### Users

#### List Users
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>"
```

#### Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "password": "password123"}'
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input |
```

---

# OpenAPI HTML Documentation

Use Swagger UI for interactive docs:

```typescript
// src/docs.ts
import { SwaggerUI } from 'hono-swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { apiRoutes } from './routes';

const app = new OpenAPIHono();

app.use('/swagger-ui/*', SwaggerUI({ url: '/doc' }));

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'MVP API',
    version: 'v1',
  },
});
```

---

# Postman Collection Template

```json
{
  "info": {
    "name": "MVP API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/api/auth/login",
            "header": [
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\"email\": \"admin@example.com\", \"password\": \"password\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Users",
      "item": [
        {
          "name": "List",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/users",
            "header": [
              { "key": "Authorization", "value": "Bearer {{token}}" }
            ]
          }
        }
      ]
    }
  ]
}
```

---

# CHANGELOG Template

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [1.0.0] - YYYY-MM-DD

### Added
- Initial API release
- User authentication
- Product management
- Trace code generation

### Changed
- [change description]

### Deprecated
- [feature] - [reason]

### Fixed
- [bug description]
```

---

# CONTRIBUTING Template

```markdown
# Contributing

## Development Setup

```bash
git clone https://github.com/org/project.git
cd project
npm install
npm run dev
```

## Coding Standards

- TypeScript strict mode
- ESLint + Prettier
- Conventional commits

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit PR

## Commit Messages

Format: `type(scope): description`

- feat: new feature
- fix: bug fix
- docs: documentation
- refactor: code restructuring
- test: adding tests
```

---

# Constraints

**MUST DO:**
- Include examples for every endpoint
- Document all error codes
- Keep docs in sync with code
- Provide quick start guide

**MUST NOT DO:**
- Leave undocumented endpoints
- Use jargon without explanation
- Skimp on error documentation
- Forget onboarding instructions

---

# Gotchas

- **Examples are king** â€?Developers copy-paste examples
- **Error docs** â€?Document WHY errors happen, not just WHAT
- **Versioning** â€?Document breaking changes clearly
- **Interactive docs** â€?Swagger UI beats static docs
- **Search** â€?docs/ folder should be searchable
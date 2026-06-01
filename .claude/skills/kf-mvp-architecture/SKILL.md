---
name: kf-mvp-architecture
description: >-
  Load when user asks for architecture review, system design, or architectural
  decisions. Triggers: 架构审查, 系统设计, architecture review, 技术选型,
  架构决策, system design. Also load when making significant technical
  decisions or evaluating architecture.
metadata:
  pattern: reviewer + tool-wrapper
  domain: mvp-stage2
recommended_model: deepseek-v4-pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Default: Node.js + Hono + Drizzle + SQLite + Vue 3 + Vite
- Unless user explicitly overrides, enforce this stack in all outputs

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Architecture Review �?架构审查技�?

> **Core Belief**: Architecture decisions are long-lasting and expensive to reverse. Make them deliberately, document them clearly, and review them periodically. The best architecture is the simplest one that works.

**Division of Labor**: This Skill focuses on **architecture review and decisions** using Reviewer pattern with criteria and Tool Wrapper for patterns. Provides ADR (Architecture Decision Records) templates.

---

# Architecture Review Dimensions

## 1. 模块�?(Modularity)
| Check | Weight | Description |
|-------|--------|-------------|
| Clear boundaries | 20% | Modules have clear responsibilities |
| Low coupling | 20% | Modules depend minimally |
| High cohesion | 20% | Related code lives together |
| Dependency direction | 20% | Dependencies follow rules |
| Testability | 20% | Modules can be tested independently |

## 2. 可扩展�?(Scalability)
| Check | Weight | Description |
|-------|--------|-------------|
| Horizontal scaling | 25% | Can scale by adding instances |
| Vertical scaling | 25% | Resource increases help |
| Data partitioning | 25% | Data can be sharded |
| Stateless design | 25% | State stored externally |

## 3. 性能 (Performance)
| Check | Weight | Description |
|-------|--------|-------------|
| Response time | 25% | Meets SLA |
| Throughput | 25% | Handles load |
| Resource efficiency | 25% | No waste |
| Caching strategy | 25% | Appropriate caching |

## 4. 安全�?(Security)
| Check | Weight | Description |
|-------|--------|-------------|
| Auth/AuthZ | 25% | Proper access control |
| Data protection | 25% | Encryption in transit/at rest |
| Input validation | 25% | All input sanitized |
| Audit trail | 25% | Actions logged |

## 5. 可维护�?(Maintainability)
| Check | Weight | Description |
|-------|--------|-------------|
| Code clarity | 25% | Easy to understand |
| Testability | 25% | Can test thoroughly |
| Deployability | 25% | Easy to deploy |
| Observability | 25% | Can monitor/debug |

---

# Architecture Decision Record (ADR)

```markdown
# ADR-001: Use SQLite for MVP Database

## Status
Accepted

## Context
We need a database for MVP with these requirements:
- Simple deployment
- No dedicated ops required
- Fast development iteration
- Can migrate to PostgreSQL later

## Decision
We will use SQLite with Turso for development.
SQLite provides:
- Zero-config deployment
- File-based storage (easy backups)
- Drizzle ORM with SQLite support
- Easy migration path to PostgreSQL

## Consequences
### Positive
- Development velocity high
- No database server setup
- Easy local development

### Negative
- Limited concurrent writes
- Not suitable for high-traffic production
- Migration needed for scale

### Neutral
- Turso adds cloud sync capability
- Can switch to PostgreSQL with same ORM
```

---

# Architecture Patterns

## Pattern 1: Layered Architecture

```
┌────────────────────�?
�?  Presentation     �?  (Routes, Handlers)
├────────────────────�?
�?  Application     �?  (Services, Use Cases)
├────────────────────�?
�?  Domain          �?  (Entities, Business Rules)
├────────────────────�?
�?  Infrastructure  �?  (DB, External Services)
└────────────────────�?
```

## Pattern 2: Module-Based Architecture

```
src/
├── modules/
�?  ├── auth/         # Self-contained module
�?  �?  ├── routes.ts
�?  �?  ├── service.ts
�?  �?  └── types.ts
�?  ├── users/
�?  └── products/
├── shared/           # Shared utilities
�?  ├── db/
�?  └── utils/
└── index.ts
```

## Pattern 3: Clean Architecture (for complex domains)

```
src/
├── entities/         # Business objects
├── use-cases/        # Application logic
├── interfaces/       # Ports
├── adapters/         # External implementations
└── routes/           # Controllers
```

---

# Tech Stack Selection

| Component | Option A | Option B | Decision |
|-----------|----------|----------|----------|
| Web Framework | Hono | Express | **Hono** - lighter, faster |
| ORM | Drizzle | Prisma | **Drizzle** - type-safe, lightweight |
| Database | SQLite | PostgreSQL | **SQLite** - MVP, migrate later |
| Auth | JWT | Session | **JWT** - stateless |
| Validation | Zod | Joi | **Zod** - type inference |

---

# Architecture Review Report

```markdown
# Architecture Review Report

**System**: [name]
**Date**: [date]
**Reviewer**: kf-mvp-architecture

## Overall Score: [XX/100]

## Scores by Dimension

| Dimension | Score | Issues |
|-----------|-------|--------|
| Modularity | 85 | Some coupling between user and order |
| Scalability | 70 | Stateless design but single DB |
| Performance | 80 | Good caching strategy |
| Security | 90 | Proper auth and input validation |
| Maintainability | 85 | Clear module structure |

## Key Strengths
- Clean module boundaries
- Good error handling
- Comprehensive tests

## Key Weaknesses
- Database connection not pooled
- Some duplication in services
- Missing audit logging

## Recommendations
1. Implement connection pooling (high priority)
2. Extract shared service code (medium priority)
3. Add audit logging (medium priority)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scale to 1000 users | Low | High | Prepare migration to PostgreSQL |
| Security breach | Low | Critical | Penetration testing |
```

---

# Constraints

**MUST DO:**
- Document significant decisions
- Review architecture before major work
- Consider trade-offs explicitly
- Plan for migration paths

**MUST NOT DO:**
- Make decisions without context
- Ignore technical debt
- Over-engineer for scale
- Skip security review

---

# Gotchas

- **Simplicity** �?MVP should be simple; complexity is technical debt
- **Trade-offs** �?Every decision has pros and cons; document them
- **Future-proofing** �?Don't over-engineer; leave migration paths
- **Review frequency** �?Architecture decisions age; review periodically
- **Documentation** �?Undocumented decisions are lost decisions
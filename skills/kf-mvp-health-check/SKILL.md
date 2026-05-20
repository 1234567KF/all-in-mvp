---
name: kf-mvp-health-check
description: >-
  Load when user asks for code health check, quality metrics, or project health
  status. Triggers: 健康检查, 代码质量, 质量指标, health check, quality metrics,
  代码检查, vitals, lint, typecheck. Also load when evaluating project state.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-backend-tdd
      type: semantic
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Health Check — 项目健康检查技能

> **Core Belief**: Code health is visible in metrics. A healthy codebase ships faster, has fewer bugs, and scales better. Measure what matters.

**Division of Labor**: This Skill focuses on **code quality assessment** using Tool Wrapper pattern. Provides health metrics, checklists, and improvement recommendations.

---

# Core Philosophy

1. **Measure what matters** — Coverage, type safety, lint errors
2. **Trends over snapshots** — Health improves or degrades over time
3. **Actionable metrics** — Each metric has a fix path
4. **Automated checks** — Human review for issues computers can catch

---

# Health Score Formula

```
Health Score = 
  (TypeCheck: 25%) +
  (Lint: 25%) +
  (Tests: 30%) +
  (Coverage: 20%)
```

## Score Ranges

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent |
| 80-89 | B | Good |
| 70-79 | C | Acceptable |
| 60-69 | D | Needs Improvement |
| <60 | F | Critical Issues |

---

# TypeScript Type Check

## Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## Check Command

```bash
npx tsc --noEmit
```

## Score Calculation

| Errors | Score |
|--------|-------|
| 0 errors | 100% |
| 1-5 errors | 80% |
| 6-20 errors | 60% |
| 21+ errors | 40% |

---

# ESLint Configuration

```javascript
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

## Check Command

```bash
npm run lint
```

## Score Calculation

| Errors | Score |
|--------|-------|
| 0 errors | 100% |
| 1-5 errors | 80% |
| 6-20 errors | 60% |
| 21+ errors | 40% |

---

# Test Coverage

## Configuration

```json
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
```

## Check Command

```bash
npm run test:coverage
```

## Score Calculation

| Coverage | Score |
|---------|-------|
| 90%+ | 100% |
| 80-89% | 90% |
| 70-79% | 80% |
| 60-69% | 70% |
| <60% | 50% |

---

# Health Report Template

```markdown
# Project Health Report

**Project**: [name]
**Date**: [date]
**Branch**: [branch]

## Overall Score: [XX/100] - [Grade]

## Metrics

| Metric | Score | Status |
|--------|-------|--------|
| TypeScript | [XX%] | ✅/⚠️/❌ |
| Lint | [XX%] | ✅/⚠️/❌ |
| Tests | [XX%] | ✅/⚠️/❌ |
| Coverage | [XX%] | ✅/⚠️/❌ |

## Trends

| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| TypeScript | [n] | [n] | [+/-n] |
| Lint | [n] | [n] | [+/-n] |
| Coverage | [n]% | [n]% | [+/-n%] |

## Issues

### Critical
- [issue 1]
- [issue 2]

### Warnings
- [issue 1]

## Recommendations

1. [recommendation 1]
2. [recommendation 2]
```

---

# Quality Commands

```bash
# Quick health check
npm run health

# Individual checks
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run test:ci      # Tests
npm run test:coverage # Coverage

# Full pipeline
npm run ci
```

---

# Package.json Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --reporter=junit --outputFile=test-results.xml",
    "health": "npm run typecheck && npm run lint && npm run test",
    "ci": "npm run typecheck && npm run lint && npm run test:ci && npm run build"
  }
}
```

---

# Constraints

**MUST DO:**
- Run typecheck before build
- Fix lint errors (not just warnings)
- Maintain 80%+ coverage
- Track metrics over time

**MUST NOT DO:**
- Skip failing tests for speed
- Disable lint rules without reason
- Lower coverage threshold for convenience
- Ignore type errors

---

# Gotchas

- **Strict mode** — Enable TypeScript strict mode from day one
- **Coverage threshold** — Set before coverage drops, not after
- **Lint warnings** — Treat warnings as errors in CI
- **Test isolation** — Tests must run independently
- **Trend tracking** — Compare scores week over week
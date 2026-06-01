---
name: kf-mvp-health-check
description: >-
  Load when user asks for code health check, quality metrics, or project health
  status. Triggers: 健康检�? 代码质量, 质量指标, health check, quality metrics,
  代码检�? vitals, lint, typecheck. Also load when evaluating project state.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: minimax-m2.7
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


# MVP Health Check �?项目健康检查技�?

> **Core Belief**: Code health is visible in metrics. A healthy codebase ships faster, has fewer bugs, and scales better. Measure what matters.

**Division of Labor**: This Skill focuses on **code quality assessment** using Tool Wrapper pattern. Provides health metrics, checklists, and improvement recommendations.

---

# Core Philosophy

1. **Measure what matters** �?Coverage, type safety, lint errors
2. **Trends over snapshots** �?Health improves or degrades over time
3. **Actionable metrics** �?Each metric has a fix path
4. **Automated checks** �?Human review for issues computers can catch

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
| TypeScript | [XX%] | �?⚠️/�?|
| Lint | [XX%] | �?⚠️/�?|
| Tests | [XX%] | �?⚠️/�?|
| Coverage | [XX%] | �?⚠️/�?|

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

- **Strict mode** �?Enable TypeScript strict mode from day one
- **Coverage threshold** �?Set before coverage drops, not after
- **Lint warnings** �?Treat warnings as errors in CI
- **Test isolation** �?Tests must run independently
- **Trend tracking** �?Compare scores week over week

---

# Pipeline Quality Gate Checklist

> Executable checklist for each pipeline stage gate. All items must pass before proceeding to next stage.

## Stage1 �?Stage2 Gate

- [ ] PRD file exists and size > 1KB
- [ ] All 9 required chapters present (项目背景, 术语定义, 风险与约�? 业务主流�? ER关系, 功能需�? 复杂/核心专题, 核心实体状态图, 验收标准)
- [ ] 明确�?不做"清单 populated
- [ ] Each functional requirement maps to at least 1 integration test scenario
- [ ] ER relationship consistency: all table/field references match across chapters
- [ ] Terminology self-consistent (same concept = same term throughout)
- [ ] Each business flow has �? Happy Path + �? Exception Path acceptance criteria

## Stage2 �?Stage3 Gate

- [ ] All Stage2 artifacts exist (spec.md, schema.sql, api-contract.yaml, task.md, all `<module>.md`)
- [ ] MD5 hash of all artifacts matches the hash at �?lock moment
- [ ] YAML/JSON files parse without errors
- [ ] Grill review report shows all 4 dimensions passed
- [ ] Mock service running and all endpoints responding
- [ ] Integration test files exist for all modules (modules/) and scenarios (scenarios/)
- [ ] ③c static review shows 0 ERROR-level issues

## Stage3 �?Stage4 Gate

- [ ] All module directories exist with DONE markers (non .tmp)
- [ ] schema.sql syntax valid (SQLite dry-run passes)
- [ ] All unit tests pass across all modules
- [ ] All integration test files are parseable (syntax check only, not execution)
- [ ] No BLOCKED modules remaining (deferred DEFER modules OK)
- [ ] Dependency graph shows no cycles

## Stage4 �?Delivery Gate

- [ ] Integration test report non-empty
- [ ] Happy Path tests 100% pass
- [ ] Exception Path tests �?0% pass
- [ ] 0 P0 bugs, 0 P1 bugs
- [ ] All regression tests in regression/ pass
- [ ] Migration files generated and verified
- [ ] Delivery directory structure matches spec (§4.5)
- [ ] pipeline-state.json checkpoint saved

---

# Stage2 Gate Check Implementation

```typescript
// scripts/check-stage2-gate.ts
// Automated Stage2→Stage3 gate validation
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';

interface GateResult {
  item: string;
  passed: boolean;
  detail: string;
}

async function checkStage2Gate(workspaceRoot: string): Promise<GateResult[]> {
  const results: GateResult[] = [];
  
  // 1. Verify all artifacts exist
  const requiredFiles = [
    'spec.locked.md',
    'schema.sql',
    'api-contract.yaml',
    'task.md'
  ];
  
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(workspaceRoot, file));
    results.push({
      item: `Artifact: ${file}`,
      passed: exists,
      detail: exists ? 'Found' : 'MISSING'
    });
  }
  
  // 2. Verify YAML parseability
  const contractPath = path.join(workspaceRoot, 'api-contract.yaml');
  try {
    yaml.load(fs.readFileSync(contractPath, 'utf-8'));
    results.push({ item: 'YAML: api-contract.yaml', passed: true, detail: 'Valid' });
  } catch (e) {
    results.push({ item: 'YAML: api-contract.yaml', passed: false, detail: String(e) });
  }
  
  // 3. Verify MD5 consistency with lock hash
  const lockHashPath = path.join(workspaceRoot, '.stage2-lock-hash');
  if (fs.existsSync(lockHashPath)) {
    const storedHash = fs.readFileSync(lockHashPath, 'utf-8').trim();
    const currentHash = computeArtifactsHash(workspaceRoot, requiredFiles);
    const hashMatch = storedHash === currentHash;
    results.push({
      item: 'MD5: Artifact integrity',
      passed: hashMatch,
      detail: hashMatch ? 'Matches lock hash' : 'HASH MISMATCH - artifacts modified after lock'
    });
  }
  
  // 4. SQLite dry-run schema validation
  // (requires sqlite3 CLI or better-sqlite3)
  
  return results;
}

function computeArtifactsHash(root: string, files: string[]): string {
  const hash = crypto.createHash('md5');
  for (const file of files.sort()) {
    const content = fs.readFileSync(path.join(root, file));
    hash.update(content);
  }
  return hash.digest('hex');
}

// Execute and report
const results = await checkStage2Gate(process.cwd());
const failed = results.filter(r => !r.passed);

if (failed.length > 0) {
  console.error(`�?Stage2 Gate: ${failed.length} check(s) failed`);
  for (const f of failed) {
    console.error(`  - ${f.item}: ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log('�?Stage2 Gate: All checks passed');
}
```
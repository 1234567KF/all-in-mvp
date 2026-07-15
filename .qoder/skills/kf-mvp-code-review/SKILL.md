---
name: kf-mvp-code-review
description: >-
  Load when user asks to review code, check code quality, verify implementation,
  or audit module against contract. Triggers: 代码审查, review, 检查代�?
  code review, 审查实现, 验证契约, 合规检�? Also load when backend
  TDD agent triggers review.
metadata:
  pattern: reviewer
  domain: mvp-stage3
recommended_model: deepseek-v4-pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: kf-mvp-biz-expert
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


# MVP Code Reviewer �?代码审查技�?

> **Core Belief**: Code review is not nitpicking. It's the last line of defense before defects reach production. Every review must verify: contract compliance, schema consistency, exception coverage.

**Division of Labor**: This Skill focuses on **verification against specifications**. It checks implementation against api-contract.yaml, schema.sql, and module specs. Follows Reviewer pattern with modular scoring criteria.

---

# Core Philosophy

Derived from MVP Whitepaper Section 3.1 �?Code Review:

1. **Contract is law** �?Implementation must match api-contract.yaml
2. **Schema consistency** �?All database operations must use global schema
3. **Exception coverage** �?Every interface must handle error cases
4. **Four severity levels** �?ERROR / WARNING / INFO / PASS

---

# Four Review Dimensions

## Dimension 1: 接口契约一致�?(API Contract Compliance)

**Question**: Does implementation match api-contract.yaml exactly?

**Checkpoints**:
- Route paths match
- HTTP methods match
- Request DTO fields match (types, required/optional)
- Response DTO structure matches
- Error codes match
- Authentication requirements match

**Severity**:
- ERROR: Route/DTO mismatch
- WARNING: Field type conversion differences
- INFO: Documentation differences

---

## Dimension 2: Schema定义一致�?(Schema Consistency)

**Question**: Do database operations use global schema correctly?

**Checkpoints**:
- All tables referenced exist in schema.sql
- All columns referenced exist in table definition
- Foreign key relationships are respected
- Soft delete conventions applied (`WHERE deleted_at IS NULL`)
- Audit fields (created_at, updated_at) populated

**Severity**:
- ERROR: Missing table/column
- WARNING: Incorrect constraint usage
- INFO: Missing index suggestion

---

## Dimension 3: 异常路径覆盖 (Exception Coverage)

**Question**: Are all error cases properly handled?

**Checkpoints**:
- Invalid input returns 400
- Unauthenticated returns 401
- Unauthorized returns 403
- Not found returns 404
- Conflict returns 409
- Server error returns 500 (never expose internal errors)

**Test Coverage**:
- Each error case has corresponding test
- Tests verify status code AND error response format

**Severity**:
- ERROR: Exception not handled
- WARNING: Error message too detailed (exposes internals)
- INFO: Suggestion for better error messaging

---

## Dimension 4: 代码风格与最佳实�?(Code Quality)

**Question**: Is code following project conventions?

**Checkpoints**:
- Naming conventions (snake_case in DB, camelCase in TS)
- No hardcoded values (use constants/env vars)
- No SQL injection vulnerabilities (use parameterized queries)
- No sensitive data in logs
- Functions are small and focused
- Comments explain "why" not "what"

**Severity**:
- WARNING: Style deviation
- INFO: Suggestions for improvement

---

## Dimension 5: 契约一致性检查 (Contract Consistency Check) - v2.6 新增

**Question**: Does implementation maintain consistency with locked contracts?

**Checkpoints**:
- **API Contract**: All endpoints match api-contract.yaml exactly (path, method, DTOs)
- **Schema Contract**: All database operations respect schema.sql definitions
- **Module Contract**: Implementation matches module spec (modules/*.md)
- **Test Contract**: Tests cover all contract-defined scenarios
- **Error Contract**: Error responses match contract-defined error codes

**Validation Rules**:
```javascript
const CONTRACT_CONSISTENCY_RULES = {
  apiContract: {
    rule: 'Implementation must match api-contract.yaml',
    severity: 'ERROR',
    check: (impl, contract) => {
      // 路径匹配
      if (impl.path !== contract.path) return false;
      // 方法匹配
      if (impl.method !== contract.method) return false;
      // DTO匹配
      if (!matchDTO(impl.requestDTO, contract.requestDTO)) return false;
      if (!matchDTO(impl.responseDTO, contract.responseDTO)) return false;
      return true;
    }
  },
  
  schemaContract: {
    rule: 'Database operations must respect schema.sql',
    severity: 'ERROR',
    check: (impl, schema) => {
      // 表存在性
      if (!schema.tables.includes(impl.table)) return false;
      // 字段存在性
      const tableSchema = schema.getTable(impl.table);
      if (!impl.fields.every(f => tableSchema.columns.includes(f))) return false;
      // 约束检查
      if (!checkConstraints(impl, tableSchema)) return false;
      return true;
    }
  },
  
  moduleContract: {
    rule: 'Implementation must match module spec',
    severity: 'ERROR',
    check: (impl, moduleSpec) => {
      // 接口清单匹配
      const specEndpoints = moduleSpec.apis;
      const implEndpoints = impl.endpoints;
      if (!arraysEqual(specEndpoints, implEndpoints)) return false;
      // 依赖关系匹配
      if (!matchDependencies(impl.dependencies, moduleSpec.depends_on)) return false;
      return true;
    }
  }
};
```

**Severity**:
- ERROR: Contract violation (must fix)
- WARNING: Contract deviation with justification
- INFO: Contract suggestion for improvement

---

## Dimension 6: 跨模块调用检查 (Cross-Module Call Check) - v2.6 新增

**Question**: Are cross-module calls following the defined boundaries?

**Checkpoints**:
- **Direct Database Access**: No module directly accesses another module's database tables
- **Service Layer Calls**: Cross-module calls go through service layer, not direct imports
- **API Boundary Respect**: Internal module calls use API endpoints, not direct function calls
- **Dependency Direction**: Dependencies follow the dependency graph (no circular dependencies)
- **Data Isolation**: Each module only accesses its own data and explicitly shared data

**Detection Patterns**:
```javascript
// 跨模块调用检测模式
const CROSS_MODULE_CALL_PATTERNS = {
  // 检测模式1: 直接数据库访问
  directDbAccess: {
    pattern: /from\s+['"]\.\.\/(modules|db)\/[^'"]*\.(schema|table)['"]/,
    severity: 'ERROR',
    message: '禁止直接访问其他模块的数据库表'
  },
  
  // 检测模式2: 直接服务调用
  directServiceCall: {
    pattern: /from\s+['"]\.\.\/modules\/[^'"]*\/service['"]/, 
    severity: 'ERROR',
    message: '禁止直接调用其他模块的服务'
  },
  
  // 检测模式3: 循环依赖
  circularDependency: {
    detect: (moduleGraph) => {
      // 使用DFS检测循环
      const visited = new Set();
      const recursionStack = new Set();
      
      function dfs(module) {
        visited.add(module);
        recursionStack.add(module);
        
        for (const neighbor of moduleGraph[module] || []) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recursionStack.has(neighbor)) {
            return true; // 发现循环
          }
        }
        
        recursionStack.delete(module);
        return false;
      }
      
      for (const module in moduleGraph) {
        if (!visited.has(module)) {
          if (dfs(module)) return true;
        }
      }
      return false;
    },
    severity: 'ERROR',
    message: '检测到循环依赖'
  },
  
  // 检测模式4: 跨模块数据访问
  crossModuleDataAccess: {
    pattern: /this\.db\.(select|insert|update|delete).*?from\(['"](\w+)['"]/, 
    check: (match, currentModule) => {
      const table = match[2];
      const tableOwner = getTableOwner(table);
      return tableOwner !== currentModule && !isSharedTable(table);
    },
    severity: 'WARNING',
    message: '访问非本模块拥有的表'
  }
};
```

**Review Checklist**:
- [ ] 无直接数据库访问其他模块的表
- [ ] 无直接导入其他模块的服务
- [ ] 跨模块调用通过API或共享服务
- [ ] 依赖关系符合依赖图
- [ ] 数据访问遵循模块边界

**Severity**:
- ERROR: Direct cross-module violation
- WARNING: Potential boundary violation
- INFO: Suggestion for better encapsulation

---

## Dimension 7: 测试覆盖率检查 (Test Coverage Check) - v2.6 新增

**Question**: Is the implementation adequately tested?

**Checkpoints**:
- **Line Coverage**: ≥ 80% line coverage required
- **Branch Coverage**: ≥ 70% branch coverage required
- **Function Coverage**: ≥ 90% function coverage required
- **Critical Path Coverage**: All critical business paths must have tests
- **Error Path Coverage**: All error handling paths must have tests
- **Boundary Coverage**: Edge cases and boundary values must be tested

**Coverage Analysis**:
```javascript
// 测试覆盖率分析
const TEST_COVERAGE_ANALYSIS = {
  // 覆盖率阈值
  thresholds: {
    line: 80,
    branch: 70,
    function: 90,
    statement: 85
  },
  
  // 关键路径检测
  criticalPaths: [
    '用户登录流程',
    '数据创建流程',
    '数据更新流程', 
    '数据删除流程',
    '权限验证流程'
  ],
  
  // 分析覆盖率报告
  analyzeCoverageReport: (coverageReport) => {
    const results = {
      passed: true,
      details: {},
      issues: []
    };
    
    // 检查行覆盖率
    const lineCoverage = coverageReport.lines.pct;
    results.details.lines = lineCoverage;
    if (lineCoverage < this.thresholds.line) {
      results.passed = false;
      results.issues.push({
        type: 'LINE_COVERAGE',
        actual: lineCoverage,
        required: this.thresholds.line,
        severity: 'ERROR'
      });
    }
    
    // 检查分支覆盖率
    const branchCoverage = coverageReport.branches.pct;
    results.details.branches = branchCoverage;
    if (branchCoverage < this.thresholds.branch) {
      results.passed = false;
      results.issues.push({
        type: 'BRANCH_COVERAGE',
        actual: branchCoverage,
        required: this.thresholds.branch,
        severity: 'WARNING'
      });
    }
    
    // 检查函数覆盖率
    const functionCoverage = coverageReport.functions.pct;
    results.details.functions = functionCoverage;
    if (functionCoverage < this.thresholds.function) {
      results.passed = false;
      results.issues.push({
        type: 'FUNCTION_COVERAGE',
        actual: functionCoverage,
        required: this.thresholds.function,
        severity: 'ERROR'
      });
    }
    
    // 检查关键路径覆盖
    const uncoveredCriticalPaths = this.criticalPaths.filter(path => 
      !coverageReport.criticalPaths.includes(path)
    );
    if (uncoveredCriticalPaths.length > 0) {
      results.passed = false;
      results.issues.push({
        type: 'CRITICAL_PATH_COVERAGE',
        uncovered: uncoveredCriticalPaths,
        severity: 'ERROR'
      });
    }
    
    return results;
  }
};
```

**Test Quality Checks**:
- [ ] 每个公共函数至少有一个测试
- [ ] 每个API端点至少有一个happy path测试
- [ ] 每个API端点至少有一个error path测试
- [ ] 边界条件有专门测试
- [ ] 异常情况有专门测试
- [ ] 测试断言具体且明确

**Severity**:
- ERROR: Coverage below threshold
- WARNING: Coverage near threshold
- INFO: Suggestion for additional tests

---

## TDD 循环中的 Review 触发条件（白皮书 Section 6.3�?

| 场景 | 是否触发 Review | 说明 |
|------|----------------|------|
| 新功�?Red 阶段 | �?| 测试失败是预期行�?|
| Green 阶段测试仍失�?| **�?* | 实现逻辑有问题，立即 Review |
| Refactor 后测试失�?| **�?* | 重构破坏了行为，Review + 回滚或修�?|
| 新增异常路径测试 | �?| 正常 TDD 流程 |
| 模块间接口调�?| **�?* | 需验证契约一致性，Review 接口 DTO |
| 新增代码未覆盖异常路�?| **�?* | 补充测试，Review 缺失覆盖�?|

---

# Review Workflow

## Phase Gate 0: Prepare Inputs

**Confirm available**:
- [ ] Implementation files: `src/modules/<module>/`
- [ ] Contract file: `api-contract.yaml`
- [ ] Schema file: `schema.sql`
- [ ] Module spec: `<module>.md`
- [ ] Integration tests: `integration-tests/modules/<module>.test.ts`

---

## Phase Gate 1: API Contract Compliance Check

**For each endpoint in api-contract.yaml**:

1. Read route definition
2. Read implementation
3. Compare path, method, DTOs

**Output**:
```markdown
## 接口契约一致性检�?

| 契约路径 | 实现路径 | 方法 | DTO | 状�?|
|---------|---------|------|-----|------|
| POST /api/user | �?存在 | �?| �?| �?|
| GET /api/user/:id | �?存在 | �?| �?| �?|
| PUT /api/user/:id | �?缺失 | - | - | �?|

**问题清单**:
- [ ] ERROR: PUT /api/user/:id 未实�?
- [ ] WARNING: CreateUserDto缺少 email 字段校验
```

---

## Phase Gate 2: Schema Consistency Check

**For each database operation**:

1. Read schema definition
2. Read implementation SQL/queries
3. Verify field names, types, constraints

**Output**:
```markdown
## Schema定义一致性检�?

| 表名 | 操作 | 字段 | Schema | 状�?|
|------|------|------|--------|------|
| users | INSERT | email | TEXT NOT NULL | �?|
| users | INSERT | role | TEXT DEFAULT 'user' | �?|
| users | SELECT | * | WHERE deleted_at | ⚠️ 缺少WHERE |

**问题清单**:
- [ ] WARNING: users SELECT缺少软删除条�?
- [ ] ERROR: products INSERT缺少必填字段 category_id
```

---

## Phase Gate 3: Exception Coverage Check

**For each endpoint**:

1. List possible error cases
2. Check if error handling exists
3. Verify test coverage

**Output**:
```markdown
## 异常路径覆盖检�?

| 端点 | 异常类型 | 处理状�?| 测试覆盖 |
|------|----------|----------|----------|
| POST /api/user | 邮箱已存�?| �?409 | �?|
| POST /api/user | 参数缺失 | �?400 | �?|
| GET /api/user/:id | 用户不存�?| �?404 | ⚠️ 缺失 |
| POST /api/user | 未认�?| �?401 | ⚠️ 缺失 |

**问题清单**:
- [ ] WARNING: GET /api/user/:id "用户不存�? 未覆盖测�?
```

---

## Phase Gate 4: Code Quality Check

**Automated checks**:
- [ ] Naming conventions
- [ ] No hardcoded values
- [ ] No SQL injection
- [ ] Function size

**Output**:
```markdown
## 代码质量检�?

| 检查项 | 文件 | 状�?| 详情 |
|--------|------|------|------|
| 命名 | service.ts:45 | ⚠️ | userId应为user_id |
| 硬编�?| routes.ts:23 | �?| 使用硬编�?admin"，应使用常量 |
| SQL注入 | service.ts:67 | �?| 使用参数化查�?|
| 函数大小 | service.ts:120 | �?| 函数�?00行，建议拆分 |

**问题清单**:
- [ ] ERROR: routes.ts硬编码角色名
- [ ] WARNING: service.ts函数过大
```

---

## Phase Gate 5: Build Verification（复盘 D-05 — P0 强制）

> **审查完成后，执行构建验证。构建失败 → 驳回，不得标 PASS。**

**前置条件**：Phase Gate 1-4 审查完成、无 P0 ERROR。

**验证步骤**：
1. 后端：`npm run build`（检查 tsc 编译、路径别名解析）
2. 前端：`npm run build`（检查 Vite 构建、类型检查）

**构建错误分类与路由**：
| 错误类型 | 判定 | 路由目标 |
|---------|------|---------|
| 路径别名（@/ → 解析失败） | tsconfig paths 配置问题 | 开发 Agent |
| 类型错误 | 代码类型不匹配 | 开发 Agent |
| 缺失依赖 | package.json 未声明 | 开发 Agent |
| rootDir 不兼容 | monorepo 路径问题 | 开发 Agent + 架构审查 |

**输出**：
```markdown
## 构建验证

| 端 | 命令 | 结果 | 错误数 |
|----|------|:--:|:--:|
| 后端 | npm run build | ✅/❌ | N |
| 前端 | npm run build | ✅/❌ | N |

**结论**: PASS / FAIL
```

> **P0 红线**：构建失败 → P0 ERROR，驳回修复。修复后重新执行完整审查流程。

---

## Phase Gate 6: Review Report

**Generate structured report**:

```markdown
# 代码审查报告

**模块**: [module]
**审查时间**: [timestamp]
**审查�?*: kf-mvp-code-review

## 审查结果汇�?

| 维度 | 通过�?| 问题�?|
|------|--------|--------|
| 接口契约一致�?| 95% | 1 ERROR |
| Schema一致�?| 90% | 1 WARNING |
| 异常路径覆盖 | 80% | 2 WARNING |
| 代码质量 | 75% | 2 ERROR |

## 问题详情

### ERROR #1: PUT /api/user/:id 未实�?
**文件**: src/modules/user/routes.ts
**位置**: 第N�?
**问题**: 契约定义了更新接口但未实�?
**建议**: 实现更新逻辑或与业务确认是否需�?

### WARNING #1: 软删除条件缺�?
**文件**: src/modules/user/service.ts
**位置**: 第M�?
**问题**: SELECT查询未包含WHERE deleted_at IS NULL
**建议**: 添加软删除条�?

## 修复建议

1. 实现PUT /api/user/:id接口
2. 在所有SELECT查询中添加软删除条件
3. 补充异常路径测试

## 审查结论

| 结果 | 说明 |
|------|------|
| �?PASS | 无ERROR，所有WARNING已确认可接受 |
| ⚠️ CONDITIONAL PASS | 有WARNING，需确认业务可接�?|
| �?FAIL | 有ERROR，必须修�?|

**建议**:
- [ ] 修复ERROR后重新审�?
- [ ] 确认WARNING的业务影�?
```

---

# Review 流转协议

> CR 通过�?TDD Agent 方可写入 DONE 标记。打回后须重新走完整流程�?

```
TDD Agent 完成开�?�?提交 CR
  �?
CR Agent 审查
  ├── PASS �?TDD Agent 写入 DONE 标记 �?Coordinator 释放依赖模块
  └── FAIL �?TDD Agent 修复
       �?
       删除 DONE 标记（如存在�?
       �?
       TDD 重新验证（确保修复不引入新问题）
       �?
       重新提交 CR 复评
       �?
       打回上限 3 �?�?超过 �?BLOCKED �?人类介入
```

**DONE 标记写入前置条件**（全部满足才可写入）�?
1. �?所有模块测试通过
2. �?CR 终审 PASS
3. �?无已�?P0/P1 Bug

---

# Review States

## State 1: PASS

```
## 审查结论: �?PASS

所有维度检查通过�?
- �?接口契约一致�?
- �?Schema一致�?
- �?异常路径覆盖
- �?代码质量

**可进入下一阶段**
```

## State 2: CONDITIONAL PASS

```
## 审查结论: ⚠️ CONDITIONAL PASS

存在WARNING，需确认�?
- [ ] WARNING #1: [描述] - 业务确认可接受？
- [ ] WARNING #2: [描述] - 业务确认可接受？

**需要业务确认后方可进入下一阶段**
```

## State 3: FAIL

```
## 审查结论: �?FAIL

存在ERROR，必须修复：
- [ ] ERROR #1: [描述]
- [ ] ERROR #2: [描述]

**修复后重新提交审�?*
```

---

# Constraints

**MUST DO:**
- Check all four dimensions
- Report specific issues with file:line locations
- Include fix suggestions for each issue
- Return structured review report

**MUST NOT DO:**
- Pass known issues
- Suggest style changes without evidence they cause bugs
- Change code without consent (review only)
- Skip any dimension

---

# Gotchas

- **Contract is source of truth** �?If contract says 400, implementation must return 400, not 422
- **Soft delete is automatic** �?Unless specified, all SELECT must include `WHERE deleted_at IS NULL`
- **Error message sanitization** �?Never expose internal details (stack traces, SQL) in error responses
- **Test coverage matters** �?Implementation without tests is half-reviewed at best
- **Review �?rewrite** �?Suggest fixes, don't rewrite code unless explicitly asked
- **终审（DONE 前强制触发）** �?TDD Agent 所有测试通过后、写 DONE 标记前，必须触发 CR 终审
- **流转协议** �?Review �?fix �?删除 DONE 标记 �?TDD 重新验证 �?再写 DONE �?提交复评
- **打回上限** �?同一模块 CR 打回最�?3 轮，超过 �?标记 BLOCKED �?人类介入
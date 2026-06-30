---
name: kf-pipeline-coordinator
description: >-
  Load when user asks to coordinate, schedule, or dispatch modules to backend/frontend
  agents in MVP parallel development. Triggers: 调度, 分配任务, coordinator,
  任务调度, 模块分配, parallel, 并行开�? Also load when backend/frontend
  agents need module assignments.
metadata:
  pattern: pipeline
  domain: mvp-stage3
recommended_model: minimax-m2.7
graph:
  dependencies:
    - target: kf-mvp-biz-expert
      type: sequential
    - target: kf-mvp-arch-expert
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


# Pipeline Coordinator �?任务调度器技�?

> **Core Belief**: Parallel development only works when dependencies are respected. The Coordinator is the single source of truth for who does what and when.

**Division of Labor**: This Skill focuses on **task scheduling** based on dependency graph and expert-domain matching. It outputs batched module assignments. Follows Pipeline pattern with strict phase gates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 3.0 �?Pipeline Coordinator:

1. **Dependency graph is law** �?Modules are scheduled based on dependency readiness, not convenience
2. **Expert matching maximizes quality** �?Assign modules to agents with matching domains
3. **Single source of truth** �?One Coordinator, one schedule, no ambiguity
4. **Batch scheduling** �?Process modules in rounds, not one-by-one

---

# Two Scheduling Strategies

## Strategy 1: Dependency Graph Driven

**Principle**: Schedule modules based on dependency readiness.

**Algorithm**:
```
Each round:
  1. Scan all modules
  2. Filter: (not allocated) AND (all dependencies DONE)
  3. Assign filtered modules to available agents
  4. Mark assigned modules as "allocated"
  5. When agent completes, mark module as "DONE"
  6. Repeat until all modules DONE
```

**Key Concept**: "Dependencies satisfied" = dependency list empty OR all dependencies marked DONE

---

## Strategy 2: Expert Domain Matching

**Principle**: Match modules to agents based on domain expertise.

**Agent Domain Mapping**:

| Agent | Domain | Preferred Modules |
|-------|--------|-------------------|
| Backend-1 | 认证与权�?| user, role, organization, auth, jwt |
| Backend-2 | 业务核心 | product, category, order, inventory |
| Backend-3 | 工具与配�?| template, trace, code, file |

**Matching Rules**:
1. Match module domain to agent domain
2. If no matching agent available, assign to any available agent (fallback)
3. Among modules with same priority, sort by module name (deterministic)

**Cross-domain priority** (when modules > agents):

| Priority | Rule | Reason |
|----------|-------|--------|
| 1 | Modules with more dependents first | Avoid blocking long dependency chains |
| 2 | Same priority �?alphabetical by name | Deterministic, same input = same output |

---

# Combined Scheduling Flow

```
Each round:
┌─────────────────────────────────────────�?
�?Step 1: Dependency Graph Filter          �?
�?  �?Find all modules ready to schedule  �?
�?  (dependencies satisfied, not allocated)�?
├─────────────────────────────────────────�?
�?Step 2: Expert Matching                  �?
�?  �?Assign matched domain agents         �?
�?  �?Match success �?assign               �?
�?  �?Match fail �?go to fallback          �?
├─────────────────────────────────────────�?
�?Step 3: Fallback Assignment              �?
�?  �?Remaining modules �?any free agent    �?
├─────────────────────────────────────────�?
�?Step 4: Mark and Log                     �?
�?  �?Mark modules as "allocated"          �?
�?  �?Log assignment for tracking          �?
└─────────────────────────────────────────�?
```

---

# Module State Scanning (Pseudocode)

```typescript
// Coordinator module state scanner - called each scheduling round
interface ModuleState {
  name: string;
  status: 'UNALLOCATED' | 'ALLOCATED' | 'DONE' | 'BLOCKED' | 'DEFER';
  dependencies: string[];
  domain: string;
  assignedAgent?: string;
  blockedReason?: string;
}

async function scanModuleStates(
  moduleNames: string[],
  workspaceRoot: string
): Promise<Map<string, ModuleState>> {
  const states = new Map<string, ModuleState>();
  
  for (const moduleName of moduleNames) {
    const moduleDir = path.join(workspaceRoot, 'src/modules', moduleName);
    const doneMarker = path.join(moduleDir, 'DONE');
    const blockedMarker = path.join(moduleDir, 'BLOCKED');
    const deferMarker = path.join(moduleDir, 'DEFER');
    
    // Check markers in priority order (atomically-written files, not .tmp)
    if (await fileExists(deferMarker)) {
      const reason = await readFile(path.join(moduleDir, 'reason.md'));
      states.set(moduleName, { status: 'DEFER', blockedReason: reason });
    } else if (await fileExists(blockedMarker)) {
      const reason = await readFile(blockedMarker);
      states.set(moduleName, { status: 'BLOCKED', blockedReason: reason });
    } else if (await fileExists(doneMarker)) {
      states.set(moduleName, { status: 'DONE' });
    } else if (await dirExists(moduleDir)) {
      states.set(moduleName, { status: 'ALLOCATED' });
    } else {
      states.set(moduleName, { status: 'UNALLOCATED' });
    }
  }
  
  return states;
}

// Key: Only scan non-.tmp files (atomic rename guarantee)
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return !filePath.endsWith('.tmp');  // Ignore in-progress writes
  } catch {
    return false;
  }
}
```

| State | File Marker | Meaning | Coordinator Action |
|-------|-------------|---------|-------------------|
| Unallocated | Module directory doesn't exist | Not yet scheduled | Schedule in next round |
| Allocated | Directory exists, no `DONE` | Assigned to agent, in progress | Wait for completion |
| DONE | `DONE` marker file exists | Agent completed | Release dependent modules |
| BLOCKED | `BLOCKED` marker + reason | Agent encountered blocker | Read reason, decide next step |
| DEFER | `DEFER` marker + `reason.md` | Agent active deferral | Cascade DEFER to dependents, continue others |

---

# Coordinator Workflow

## 调度前自动校验（v2.6 新增）

> **在每轮调度前自动执行校验，确保调度决策的正确性。**

### 1. 依赖图完整性校验

```typescript
async function validateDependencyGraph(dependencyGraph: Map<string, string[]>): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. 检查循环依赖
  const cycles = detectCycles(dependencyGraph);
  if (cycles.length > 0) {
    errors.push(`发现循环依赖: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
  }
  
  // 2. 检查孤儿模块（无依赖且不被依赖）
  const orphans = findOrphanModules(dependencyGraph);
  if (orphans.length > 0) {
    warnings.push(`发现孤儿模块: ${orphans.join(', ')}`);
  }
  
  // 3. 检查隐式依赖
  const implicitDeps = await detectImplicitDependencies(dependencyGraph);
  if (implicitDeps.length > 0) {
    warnings.push(`发现隐式依赖: ${implicitDeps.map(d => `${d.from} -> ${d.to}`).join(', ')}`);
  }
  
  // 4. 检查依赖链深度
  const maxDepth = calculateMaxDependencyDepth(dependencyGraph);
  if (maxDepth > 5) {
    warnings.push(`依赖链过深 (${maxDepth} 层)，可能影响并行效率`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      totalModules: dependencyGraph.size,
      orphanCount: orphans.length,
      maxDepth,
      cycleCount: cycles.length
    }
  };
}

// 循环依赖检测（拓扑排序）
function detectCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const dependencies = graph.get(node) || [];
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        dfs(dep, [...path]);
      } else if (recursionStack.has(dep)) {
        // 发现循环
        const cycleStart = path.indexOf(dep);
        cycles.push(path.slice(cycleStart));
      }
    }
    
    recursionStack.delete(node);
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }
  
  return cycles;
}

// 孤儿模块检测
function findOrphanModules(graph: Map<string, string[]>): string[] {
  const allModules = new Set(graph.keys());
  const dependentModules = new Set<string>();
  
  for (const deps of graph.values()) {
    deps.forEach(dep => dependentModules.add(dep));
  }
  
  return [...allModules].filter(m => !dependentModules.has(m) && (graph.get(m) || []).length === 0);
}

// 隐式依赖检测（通过DTO引用分析）
async function detectImplicitDependencies(graph: Map<string, string[]>): Promise<Array<{from: string, to: string, reason: string}>> {
  const implicitDeps: Array<{from: string, to: string, reason: string}> = [];
  
  for (const [module, deps] of graph.entries()) {
    const moduleSpec = await readModuleSpec(module);
    
    // 检查DTO中引用的其他模块表字段
    for (const [otherModule, otherDeps] of graph.entries()) {
      if (module === otherModule) continue;
      if (deps.includes(otherModule)) continue; // 已声明依赖
      
      const otherSpec = await readModuleSpec(otherModule);
      
      // 检查是否有跨模块表引用
      if (hasTableReference(moduleSpec, otherSpec.tables)) {
        implicitDeps.push({
          from: module,
          to: otherModule,
          reason: `${module} 的 DTO 引用了 ${otherModule} 的表字段`
        });
      }
    }
  }
  
  return implicitDeps;
}

// 依赖链深度计算
function calculateMaxDependencyDepth(graph: Map<string, string[]>): number {
  const depths = new Map<string, number>();
  
  function getDepth(node: string): number {
    if (depths.has(node)) return depths.get(node)!;
    
    const deps = graph.get(node) || [];
    if (deps.length === 0) {
      depths.set(node, 0);
      return 0;
    }
    
    const maxDepDepth = Math.max(...deps.map(d => getDepth(d)));
    depths.set(node, maxDepDepth + 1);
    return maxDepDepth + 1;
  }
  
  let maxDepth = 0;
  for (const node of graph.keys()) {
    maxDepth = Math.max(maxDepth, getDepth(node));
  }
  
  return maxDepth;
}
```

### 2. 冲突检测校验

```typescript
async function detectConflicts(modules: string[]): Promise<ConflictReport> {
  const conflicts: Conflict[] = [];
  
  // 1. 路由冲突检测
  const routeConflicts = await detectRouteConflicts(modules);
  conflicts.push(...routeConflicts);
  
  // 2. Schema冲突检测
  const schemaConflicts = await detectSchemaConflicts(modules);
  conflicts.push(...schemaConflicts);
  
  // 3. 文件名冲突检测
  const fileConflicts = await detectFileNameConflicts(modules);
  conflicts.push(...fileConflicts);
  
  // 4. 依赖版本冲突检测
  const versionConflicts = await detectDependencyVersionConflicts(modules);
  conflicts.push(...versionConflicts);
  
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    summary: {
      route: routeConflicts.length,
      schema: schemaConflicts.length,
      file: fileConflicts.length,
      version: versionConflicts.length
    }
  };
}

// 路由冲突检测
async function detectRouteConflicts(modules: string[]): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const routes = new Map<string, string[]>(); // route -> modules[]
  
  for (const module of modules) {
    const moduleRoutes = await extractModuleRoutes(module);
    
    for (const route of moduleRoutes) {
      const key = `${route.method} ${route.path}`;
      if (!routes.has(key)) routes.set(key, []);
      routes.get(key)!.push(module);
    }
  }
  
  for (const [route, moduleList] of routes.entries()) {
    if (moduleList.length > 1) {
      conflicts.push({
        type: 'ROUTE',
        severity: 'HIGH',
        description: `路由冲突: ${route} 被多个模块定义`,
        modules: moduleList,
        resolution: '合并路由或调整路径前缀'
      });
    }
  }
  
  return conflicts;
}

// Schema冲突检测
async function detectSchemaConflicts(modules: string[]): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const tables = new Map<string, Array<{module: string, columns: ColumnDefinition[]}>>();
  
  for (const module of modules) {
    const moduleTables = await extractModuleTables(module);
    
    for (const table of moduleTables) {
      if (!tables.has(table.name)) tables.set(table.name, []);
      tables.get(table.name)!.push({ module, columns: table.columns });
    }
  }
  
  for (const [tableName, tableEntries] of tables.entries()) {
    if (tableEntries.length > 1) {
      // 检查列定义是否一致
      const firstColumns = tableEntries[0].columns;
      const conflictingColumns: string[] = [];
      
      for (let i = 1; i < tableEntries.length; i++) {
        const currentColumns = tableEntries[i].columns;
        for (const col of currentColumns) {
          const existing = firstColumns.find(c => c.name === col.name);
          if (existing && existing.type !== col.type) {
            conflictingColumns.push(`${col.name} (${existing.type} vs ${col.type})`);
          }
        }
      }
      
      if (conflictingColumns.length > 0) {
        conflicts.push({
          type: 'SCHEMA',
          severity: 'HIGH',
          description: `表 ${tableName} 的列定义冲突: ${conflictingColumns.join(', ')}`,
          modules: tableEntries.map(e => e.module),
          resolution: '统一列定义或使用最新版本'
        });
      }
    }
  }
  
  return conflicts;
}
```

### 3. 调度前校验报告

```typescript
async function generatePreScheduleReport(
  dependencyGraph: Map<string, string[]>,
  modules: string[]
): Promise<PreScheduleReport> {
  
  // 1. 依赖图校验
  const graphValidation = await validateDependencyGraph(dependencyGraph);
  
  // 2. 冲突检测
  const conflictReport = await detectConflicts(modules);
  
  // 3. 资源可用性检查
  const resourceCheck = await checkResourceAvailability(modules);
  
  // 4. 生成报告
  const report: PreScheduleReport = {
    timestamp: new Date().toISOString(),
    validation: {
      dependencyGraph: graphValidation,
      conflicts: conflictReport,
      resources: resourceCheck
    },
    canSchedule: graphValidation.valid && !conflictReport.hasConflicts && resourceCheck.available,
    recommendations: [] as string[]
  };
  
  // 生成建议
  if (!graphValidation.valid) {
    report.recommendations.push('修复循环依赖后再调度');
  }
  if (conflictReport.hasConflicts) {
    report.recommendations.push('解决冲突后再调度');
  }
  if (graphValidation.warnings.length > 0) {
    report.recommendations.push(...graphValidation.warnings);
  }
  
  return report;
}
```

## 调度后自动验证（v2.6 新增）

> **每轮调度后自动验证调度决策的正确性。**

### 1. 三检机制增强版

```typescript
async function tripleCheckEnhanced(
  assigned: Map<string, string>, // module -> agent
  unassigned: Set<string>,
  allModules: string[],
  dependencyGraph: Map<string, string[]>,
  moduleStates: Map<string, ModuleState>
): Promise<TripleCheckResult> {
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // ① 全集校验
  const assignedSet = new Set(assigned.keys());
  const union = new Set([...assignedSet, ...unassigned]);
  if (union.size !== allModules.length) {
    errors.push(`全集校验失败：分配 ${assignedSet.size} + 未分配 ${unassigned.size} != 总数 ${allModules.length}`);
  }
  
  // ② 依赖校验
  for (const [module, agent] of assigned.entries()) {
    const deps = dependencyGraph.get(module) || [];
    const unsatisfiedDeps = deps.filter(dep => {
      const depState = moduleStates.get(dep);
      return !depState || depState.status !== 'DONE';
    });
    
    if (unsatisfiedDeps.length > 0) {
      errors.push(`依赖校验失败：${module} 的依赖未满足: ${unsatisfiedDeps.join(', ')}`);
    }
  }
  
  // ③ 容量校验
  const availableSlots = await getAvailableAgentSlots();
  if (assigned.size > availableSlots) {
    warnings.push(`容量校验警告：分配 ${assigned.size} > 空闲 ${availableSlots}，将按优先级裁剪`);
  }
  
  // ④ 领域匹配校验
  for (const [module, agent] of assigned.entries()) {
    const moduleDomain = await getModuleDomain(module);
    const agentDomain = await getAgentDomain(agent);
    
    if (moduleDomain !== agentDomain) {
      warnings.push(`领域不匹配：${module} (${moduleDomain}) 分配给 ${agent} (${agentDomain})`);
    }
  }
  
  // ⑤ 循环调度检测
  const schedulingHistory = await getSchedulingHistory();
  const currentAssignment = Array.from(assigned.entries()).sort();
  
  for (const historical of schedulingHistory) {
    if (arraysEqual(currentAssignment, historical.assignment)) {
      warnings.push('检测到重复调度模式，可能存在调度死循环');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      assignedCount: assigned.size,
      unassignedCount: unassigned.size,
      domainMatchRate: await calculateDomainMatchRate(assigned)
    }
  };
}
```

### 2. 调度后验证报告

```typescript
async function generatePostScheduleReport(
  round: number,
  assigned: Map<string, string>,
  tripleCheckResult: TripleCheckResult
): Promise<PostScheduleReport> {
  
  const report: PostScheduleReport = {
    round,
    timestamp: new Date().toISOString(),
    assignments: Array.from(assigned.entries()).map(([module, agent]) => ({
      module,
      agent,
      domain: await getModuleDomain(module),
      dependencies: await getModuleDependencies(module)
    })),
    validation: tripleCheckResult,
    nextRoundPredictions: await predictNextRound(assigned)
  };
  
  return report;
}
```

## 异常模块自动处理（v2.6 新增）

> **自动处理 BLOCKED/DEFER 状态的模块，减少人工干预。**

### 1. BLOCKED模块自动处理

```typescript
async function handleBlockedModules(
  blockedModules: Map<string, BlockedInfo>
): Promise<HandlingResult> {
  
  const results: ModuleHandling[] = [];
  
  for (const [module, info] of blockedModules.entries()) {
    const handling = await determineHandlingStrategy(module, info);
    results.push(handling);
    
    // 执行处理策略
    await executeHandlingStrategy(handling);
  }
  
  return {
    handled: results.filter(r => r.action !== 'WAIT').length,
    waiting: results.filter(r => r.action === 'WAIT').length,
    details: results
  };
}

async function determineHandlingStrategy(
  module: string,
  info: BlockedInfo
): Promise<ModuleHandling> {
  
  // 1. 分析阻塞原因
  const reason = analyzeBlockingReason(info.reason);
  
  // 2. 根据原因类型选择策略
  switch (reason.type) {
    case 'DEPENDENCY_NOT_READY':
      // 依赖未就绪 → 等待
      return {
        module,
        action: 'WAIT',
        reason: `等待依赖模块 ${reason.dependency} 完成`,
        estimatedWaitTime: await estimateDependencyCompletionTime(reason.dependency)
      };
    
    case 'CONTRACT_INCONSISTENCY':
      // 契约不一致 → 触发契约同步
      return {
        module,
        action: 'SYNC_CONTRACT',
        reason: '契约不一致，触发同步流程',
        steps: [
          '暂停当前模块开发',
          '更新 api-contract.yaml',
          '同步 Mock 服务',
          '通知相关 Agent',
          '重新开始模块开发'
        ]
      };
    
    case 'AGENT_FAILURE':
      // Agent失败 → 重新分配
      return {
        module,
        action: 'REASSIGN',
        reason: `Agent ${info.agent} 失败，重新分配`,
        newAgent: await findAlternativeAgent(module, info.agent)
      };
    
    case 'COMPLEXITY_EXCEEDED':
      // 复杂度超限 → 拆分或降级
      return {
        module,
        action: 'DEGRADE',
        reason: '模块复杂度超限，降级实现',
        degradationPlan: await createDegradationPlan(module)
      };
    
    case 'UNKNOWN':
    default:
      // 未知原因 → 标记需人工介入
      return {
        module,
        action: 'ESCALATE',
        reason: '未知阻塞原因，需人工介入',
        escalationLevel: 'HIGH'
      };
  }
}

// 执行处理策略
async function executeHandlingStrategy(handling: ModuleHandling): Promise<void> {
  switch (handling.action) {
    case 'WAIT':
      // 等待，不做任何操作
      console.log(`[Coordinator] 模块 ${handling.module} 等待中: ${handling.reason}`);
      break;
    
    case 'SYNC_CONTRACT':
      // 触发契约同步流程
      await triggerContractSync(handling.module);
      break;
    
    case 'REASSIGN':
      // 重新分配给新Agent
      await reassignModule(handling.module, handling.newAgent!);
      break;
    
    case 'DEGRADE':
      // 降级实现
      await degradeModule(handling.module, handling.degradationPlan!);
      break;
    
    case 'ESCALATE':
      // 升级到人工处理
      await escalateToHuman(handling.module, handling.reason, handling.escalationLevel!);
      break;
  }
}
```

### 2. DEFER模块自动处理

```typescript
async function handleDeferredModules(
  deferredModules: Map<string, DeferInfo>
): Promise<HandlingResult> {
  
  const results: ModuleHandling[] = [];
  
  for (const [module, info] of deferredModules.entries()) {
    // 1. 分析推迟原因
    const reason = analyzeDeferralReason(info.reason);
    
    // 2. 评估是否可以恢复
    const canResume = await evaluateResumption(module, reason);
    
    if (canResume) {
      // 3a. 可以恢复 → 恢复模块开发
      results.push({
        module,
        action: 'RESUME',
        reason: '推迟原因已解决，恢复开发',
        resumeSteps: await createResumptionPlan(module)
      });
    } else {
      // 3b. 无法恢复 → 级联推迟依赖模块
      results.push({
        module,
        action: 'CASCADE_DEFER',
        reason: '无法恢复，级联推迟依赖模块',
        cascadedModules: await findDependentModules(module)
      });
    }
  }
  
  return {
    handled: results.filter(r => r.action === 'RESUME').length,
    cascaded: results.filter(r => r.action === 'CASCADE_DEFER').length,
    details: results
  };
}

// 评估是否可以恢复
async function evaluateResumption(module: string, reason: DeferReason): Promise<boolean> {
  switch (reason.type) {
    case 'EXTERNAL_SERVICE_UNAVAILABLE':
      // 外部服务不可用 → 检查服务状态
      return await checkExternalServiceStatus(reason.service);
    
    case 'REQUIREMENT_DISPUTED':
      // 需求争议 → 检查是否已解决
      return await checkRequirementResolution(module);
    
    case 'COMPLEXITY_HIGH':
      // 复杂度高 → 检查是否已简化
      return await checkSimplificationStatus(module);
    
    default:
      return false;
  }
}
```

### 3. 异常处理配置

```typescript
const EXCEPTION_HANDLING_CONFIG = {
  // BLOCKED处理策略
  blocked: {
    autoRetry: {
      enabled: true,
      maxAttempts: 3,
      delayMs: 5000
    },
    autoSync: {
      enabled: true,
      contractSync: true,
      mockSync: true
    },
    autoReassign: {
      enabled: true,
      maxReassigns: 2
    },
    escalation: {
      timeoutMs: 30 * 60 * 1000, // 30分钟超时升级
      levels: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    }
  },
  
  // DEFER处理策略
  defer: {
    autoResume: {
      enabled: true,
      checkIntervalMs: 5 * 60 * 1000 // 每5分钟检查一次
    },
    cascade: {
      enabled: true,
      maxDepth: 3 // 最多级联3层
    }
  },
  
  // 告警配置
n  alerts: {
    blockedTimeout: 15 * 60 * 1000, // 15分钟阻塞告警
    deferTimeout: 60 * 60 * 1000,   // 1小时推迟告警
    escalationNotify: true
  }
};
```

## Phase Gate 0: Initialization

**Confirm inputs**:
- [ ] task.md is read and understood
- [ ] All `<module>.md` files are available
- [ ] Agent availability is known (or assumed based on count limits)

**Limits**:
- Backend: max 3 agents in parallel
- Frontend: max 3 agents in parallel

---

## Phase Gate 1: Build Dependency Graph

1. Read all `<module>.md` files
2. Extract dependencies from each module
3. Build adjacency list:
   ```
   {
     "user": [],
     "product": ["user", "organization"],
     "trace": ["product", "template"]
   }
   ```
4. Verify no cycles (if cycle found, report BLOCKED)
5. Calculate in-degree for each module

**Output**:
```markdown
## 依赖图分�?

| 模块 | 依赖模块 | 被依赖次�?| 是否就绪 |
|------|----------|------------|----------|
| user | - | 2 | �?|
| organization | - | 1 | �?|
| product | user, organization | 1 | �?(等待依赖) |
| template | user | 1 | �?(等待依赖) |
| trace | product, template | 0 | �?(等待依赖) |

**图结�?*:
- Round 1 可调�? user, organization
- Round 2 可调�? product, template
- Round 3 可调�? trace
```

---

## Phase Gate 2: First Round Scheduling

**Input**: Ready modules from Phase Gate 1

**For each ready module**:
1. Determine module domain
2. Find matching agent
3. Create assignment

**Output Assignment**:
```markdown
## Round 1 分配指令

**Agent**: Backend-1 (认证与权限专�?
**分配模块**: user
**模块路径**: src/modules/user/
**验收标准**: �?kf-mvp-biz-expert/user.md

**Agent**: Backend-1 (认证与权限专�?
**分配模块**: organization
**模块路径**: src/modules/organization/
**验收标准**: �?kf-mvp-biz-expert/organization.md
```

**Agent spawn instruction**:
```yaml
# Agent 分配摘要（Coordinator �?Agent，用于降低上下文消耗）
agent: Backend-1
role: 后端开发专�?
domain: 认证与权�?
module: user
apis:
  - GET /api/users
  - POST /api/users
  - GET /api/users/:id
tables:
  - users (id, email, password_hash, role)
acceptance:
  happy_path: 3
  exception_path: 4
module_spec_path: src/modules/user.md
integration_test: integration-tests/modules/user.test.ts
```

> Agent 需要完整信息时通过文件路径按需读取 `<module>.md`。摘要版 YAML 降低上下文消耗�?

**完整执行指令**:
```
Agent: Backend-1
Role: 后端开发专�?
Domain: 认证与权�?
Assigned: user module

Read: 
- PRD: [path]
- spec.md: [path]
- schema.sql: [path]
- module spec: src/modules/user.md
- integration test: integration-tests/modules/user.test.ts

Execute TDD loop:
1. Write failing test in integration-tests/modules/user.test.ts
2. Implement in src/modules/user/
3. Refactor
4. Run code review before commit
5. Create DONE marker when complete
```

---

## Phase Gate 3: Progress Tracking

**After each round, track**:

```markdown
## 调度状�?

| 模块 | 状�?| Agent | 完成时间 |
|------|------|-------|----------|
| user | ALLOCATED | Backend-1 | - |
| organization | ALLOCATED | Backend-2 | - |
| product | PENDING | - | - |
| template | PENDING | - | - |
| trace | PENDING | - | - |
```

**Check completion**:
1. Look for `DONE` marker files
2. Update module status to DONE
3. Re-evaluate dependency graph for next round

---

## Phase Gate 4: Next Round Scheduling

**When a module completes**:
1. Mark module as DONE
2. Update dependency graph
3. Find newly ready modules
4. Schedule in next round

**Repeat** until all modules DONE.

---

### 每轮分配后：三检机制（MUST�?

> 每轮分配完成后，Coordinator 必须执行「三检」，任一失败 �?写入 `SCHEDULER_ERROR.md` �?人类介入�?

| 检查项 | 验证内容 | 失败处理 |
|--------|---------|---------|
| **�?全集校验** | 已分配集�?+ 未分配集�?== 模块全集 | 漏分配或重复分配 �?ERROR |
| **�?依赖校验** | 已分配模块的依赖是否全部 DONE | 依赖未满�?�?回退该模块为 UNALLOCATED |
| **�?容量校验** | 本轮分配�?�?空闲 Agent �?| 超配 �?自动按优先级裁剪到空�?slot �?|

```typescript
// 三检伪代�?
function tripleCheck(assigned: Set<string>, unassigned: Set<string>, all: string[]): CheckResult {
  // �?全集校验
  if (assigned.size + unassigned.size !== all.length) {
    return { pass: false, error: '全集校验失败：漏分配或重复分�? };
  }
  // �?依赖校验
  for (const mod of assigned) {
    if (!allDepsDone(mod)) {
      return { pass: false, error: `依赖校验失败�?{mod} 的依赖未满足` };
    }
  }
  // �?容量校验
  if (assigned.size > availableSlots) {
    return { pass: false, error: `容量校验失败：分�?${assigned.size} > 空闲 ${availableSlots}` };
  }
  return { pass: true };
}
```

---

### 状态持久化（pipeline-state.json�?

Coordinator 维护 `pipeline-state.json`，每次状态变更原子写入（先写临时文件 �?重命名）�?

```json
{
  "pipeline_id": "uuid",
  "stage": "Stage3",
  "current_round": 2,
  "agent_slots": {
    "backend": [
      { "id": "be-1", "status": "BUSY", "module": "user", "since": "2026-05-24T10:00:00Z" },
      { "id": "be-2", "status": "BUSY", "module": "product", "since": "2026-05-24T10:00:00Z" },
      { "id": "be-3", "status": "IDLE", "module": null, "since": null }
    ],
    "frontend": []
  },
  "module_states": {
    "user": { "status": "ALLOCATED", "agent": "be-1", "allocated_at": "2026-05-24T10:00:00Z" },
    "product": { "status": "ALLOCATED", "agent": "be-2", "allocated_at": "2026-05-24T10:00:00Z" },
    "trace": { "status": "UNALLOCATED", "agent": null, "allocated_at": null }
  },
  "last_checkpoint": "2026-05-24T10:00:00Z"
}
```

**崩溃恢复**：Coordinator 重启后读�?`pipeline-state.json`，恢复所�?slot 和模块状态�?

---

### 数据竞争检�?

> 每个领域所有模�?DONE 后执行一次，检测多模块操作同一张表引发的潜在竞争�?

```
触发条件：某个领域（认证/业务核心/工具配置）下所有模�?DONE
  �?
1. 提取该领域所有模块的 schema 定义
2. 检测是否存在两个模块操作同一张表（即使操作不同字段）
3. 检测外键关联表上的操作时序是否正确
4. 发现潜在竞争 �?写入 race-condition-warnings.md
  �?
Stage4 联调重点验证 race-condition-warnings.md 中列出的�?
```

**race-condition-warnings.md 模板**�?
```markdown
# Data Race Condition Warnings

**检测时�?*: [ISO datetime]
**检测领�?*: 业务核心

## 潜在数据竞争

| 表名 | 操作模块 A | 操作模块 B | 冲突类型 | 风险 |
|------|-----------|-----------|---------|------|
| products | product (WRITE) | trace (READ) | 读写竞争 | �?|

## 建议验证�?
- [ ] 并发场景�?product 写入同时 trace 读取的一致�?
```

---

### Phase Gate 5: File Race Protection

**Principle**: All marker files use atomic write-then-rename to prevent partial reads.

**Write Protocol**:
```typescript
// NEVER write directly to the final filename
// ALWAYS: write .tmp �?atomic rename
import { writeFile, rename } from 'fs/promises';

async function atomicWriteMarker(
  moduleDir: string,
  markerName: 'DONE' | 'BLOCKED' | 'DEFER',
  content: string
): Promise<void> {
  const tmpPath = path.join(moduleDir, `${markerName}.tmp`);
  const finalPath = path.join(moduleDir, markerName);
  
  // Step 1: Write all content to temp file
  await writeFile(tmpPath, content, 'utf-8');
  
  // Step 2: Atomic rename (filesystem guarantees atomicity on same volume)
  await rename(tmpPath, finalPath);
  
  // Coordinator only scans non-.tmp files, never sees partial writes
}

// Reading side: ignore .tmp files
async function scanMarkers(moduleDir: string): Promise<string[]> {
  const entries = await readdir(moduleDir);
  return entries.filter(f => !f.endsWith('.tmp'));
}
```

**Race Condition Protection**:
- `.tmp` suffix = file being written (ignore)
- No `.tmp` suffix = complete file (read)
- `rename()` is atomic on same filesystem = no partial reads possible
- Coordinator crash during write: `.tmp` file orphaned, next scan ignores it

---

### Situation: Module BLOCKED

**Output**:
```markdown
## 模块阻塞报告

**阻塞模块**: trace
**阻塞原因**: product 模块产出�?api-contract.yaml 不一�?
**建议处理**:
1. 暂停 trace 开�?
2. 优先修复 product 不一致问�?
3. 重新同步后恢�?trace 开�?

**决策**:
- [ ] 继续等待 product 修复
- [ ] 调整依赖关系
- [ ] 人工介入
```

### Situation: Agent Unavailable

**Fallback rules**:
1. If matched agent unavailable �?assign to any available agent
2. If no agents available �?queue module for next round
3. Never wait indefinitely for specific agent

---

# Scheduling Summary

After all modules scheduled:

```markdown
# 调度总结

## 分配历史

| Round | 分配模块 | Agent | 状�?|
|-------|----------|-------|------|
| 1 | user, organization | Backend-1, Backend-2 | DONE |
| 2 | product, template | Backend-2, Backend-3 | DONE |
| 3 | trace | Backend-3 | DONE |

## 关键路径

最长的依赖链决定了总工期：
user �?product �?trace (3�?

## 并行效率

- 最大并行度: 3 agents
- 理论工期: 3 rounds
- 实际工期: [measured]
```

---

# Constraints

**MUST DO:**
- Respect dependency graph (no scheduling modules with unmet dependencies)
- Match agents to domains when possible
- Log all assignments for traceability
- Handle exceptions explicitly
- Detect VISUAL_PENDING markers and **do NOT** treat them as DONE
- Notify human when VISUAL_PENDING files accumulate (�?2 unconfirmed)

**MUST NOT DO:**
- Schedule based on urgency alone (dependencies come first)
- Assign modules with unmet dependencies
- Let agent choose which module (Coordinator decides)
- Skip logging (maintain state as files)
- Release downstream dependencies of VISUAL_PENDING modules (they are NOT complete)

---

# Gotchas

- **Dependency is prerequisite, not preference** �?A module cannot start until all its dependencies are DONE
- **Name stability** �?Sort by name for deterministic scheduling (same input = same output)
- **Domain matching is soft** �?If no match available, fallback to any agent
- **State lives in files** �?DONE/BLOCKED markers are the source of truth, not memory
- **Coordinator is lightweight** �?It doesn't write code, just manages state and dispatches
- **VISUAL_PENDING is NOT DONE (v2.5)** �?Frontend modules with VISUAL_PENDING markers are incomplete. Do NOT release their downstream dependencies. Send a prompt to human: "N 个前端页面等待视觉确认，请在浏览器中审核后删�?VISUAL_PENDING 文件并创�?DONE"
- **VISUAL_PENDING accumulation alert** �?If �?2 VISUAL_PENDING files exist for > 30 min, escalate to human. This prevents pipeline stall from forgotten visual reviews.
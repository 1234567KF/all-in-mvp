---
name: kf-pipeline-coordinator
description: >-
  Load when user asks to coordinate, schedule, or dispatch modules to backend/frontend
  agents in MVP parallel development. Triggers: 调度, 分配任务, coordinator,
  任务调度, 模块分配, parallel, 并行开发. Also load when backend/frontend
  agents need module assignments.
metadata:
  pattern: pipeline
  domain: mvp-stage3
recommended_model: pro
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


# Pipeline Coordinator — 任务调度器技能

> **Core Belief**: Parallel development only works when dependencies are respected. The Coordinator is the single source of truth for who does what and when.

**Division of Labor**: This Skill focuses on **task scheduling** based on dependency graph and expert-domain matching. It outputs batched module assignments. Follows Pipeline pattern with strict phase gates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 3.0 — Pipeline Coordinator:

1. **Dependency graph is law** — Modules are scheduled based on dependency readiness, not convenience
2. **Expert matching maximizes quality** — Assign modules to agents with matching domains
3. **Single source of truth** — One Coordinator, one schedule, no ambiguity
4. **Batch scheduling** — Process modules in rounds, not one-by-one

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
| Backend-1 | 认证与权限 | user, role, organization, auth, jwt |
| Backend-2 | 业务核心 | product, category, order, inventory |
| Backend-3 | 工具与配置 | template, trace, code, file |

**Matching Rules**:
1. Match module domain to agent domain
2. If no matching agent available, assign to any available agent (fallback)
3. Among modules with same priority, sort by module name (deterministic)

**Cross-domain priority** (when modules > agents):

| Priority | Rule | Reason |
|----------|-------|--------|
| 1 | Modules with more dependents first | Avoid blocking long dependency chains |
| 2 | Same priority → alphabetical by name | Deterministic, same input = same output |

---

# Combined Scheduling Flow

```
Each round:
┌─────────────────────────────────────────┐
│ Step 1: Dependency Graph Filter          │
│   → Find all modules ready to schedule  │
│   (dependencies satisfied, not allocated)│
├─────────────────────────────────────────┤
│ Step 2: Expert Matching                  │
│   → Assign matched domain agents         │
│   → Match success → assign               │
│   → Match fail → go to fallback          │
├─────────────────────────────────────────┤
│ Step 3: Fallback Assignment              │
│   → Remaining modules → any free agent    │
├─────────────────────────────────────────┤
│ Step 4: Mark and Log                     │
│   → Mark modules as "allocated"          │
│   → Log assignment for tracking          │
└─────────────────────────────────────────┘
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
## 依赖图分析

| 模块 | 依赖模块 | 被依赖次数 | 是否就绪 |
|------|----------|------------|----------|
| user | - | 2 | ✅ |
| organization | - | 1 | ✅ |
| product | user, organization | 1 | ❌ (等待依赖) |
| template | user | 1 | ❌ (等待依赖) |
| trace | product, template | 0 | ❌ (等待依赖) |

**图结构**:
- Round 1 可调度: user, organization
- Round 2 可调度: product, template
- Round 3 可调度: trace
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

**Agent**: Backend-1 (认证与权限专家)
**分配模块**: user
**模块路径**: src/modules/user/
**验收标准**: 见 kf-mvp-biz-expert/user.md

**Agent**: Backend-1 (认证与权限专家)
**分配模块**: organization
**模块路径**: src/modules/organization/
**验收标准**: 见 kf-mvp-biz-expert/organization.md
```

**Agent spawn instruction**:
```
Agent: Backend-1
Role: 后端开发专家
Domain: 认证与权限
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
## 调度状态

| 模块 | 状态 | Agent | 完成时间 |
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

## Phase Gate 5: File Race Protection

**Principle**: All marker files use atomic write-then-rename to prevent partial reads.

**Write Protocol**:
```typescript
// NEVER write directly to the final filename
// ALWAYS: write .tmp → atomic rename
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
**阻塞原因**: product 模块产出与 api-contract.yaml 不一致
**建议处理**:
1. 暂停 trace 开发
2. 优先修复 product 不一致问题
3. 重新同步后恢复 trace 开发

**决策**:
- [ ] 继续等待 product 修复
- [ ] 调整依赖关系
- [ ] 人工介入
```

### Situation: Agent Unavailable

**Fallback rules**:
1. If matched agent unavailable → assign to any available agent
2. If no agents available → queue module for next round
3. Never wait indefinitely for specific agent

---

# Scheduling Summary

After all modules scheduled:

```markdown
# 调度总结

## 分配历史

| Round | 分配模块 | Agent | 状态 |
|-------|----------|-------|------|
| 1 | user, organization | Backend-1, Backend-2 | DONE |
| 2 | product, template | Backend-2, Backend-3 | DONE |
| 3 | trace | Backend-3 | DONE |

## 关键路径

最长的依赖链决定了总工期：
user → product → trace (3轮)

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

**MUST NOT DO:**
- Schedule based on urgency alone (dependencies come first)
- Assign modules with unmet dependencies
- Let agent choose which module (Coordinator decides)
- Skip logging (maintain state as files)

---

# Gotchas

- **Dependency is prerequisite, not preference** — A module cannot start until all its dependencies are DONE
- **Name stability** — Sort by name for deterministic scheduling (same input = same output)
- **Domain matching is soft** — If no match available, fallback to any agent
- **State lives in files** — DONE/BLOCKED markers are the source of truth, not memory
- **Coordinator is lightweight** — It doesn't write code, just manages state and dispatches
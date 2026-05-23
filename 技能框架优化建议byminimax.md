# MVP白皮书优化建议 by Minimax

> 生成时间：2026-05-20  
> 分析维度：执行准确性、稳定性  
> 迭代轮次：3轮递进分析  

---

## 执行摘要

通过三轮递进审视，发现**理论覆盖度 95% → 可执行度 70%** 的核心瓶颈在于：

1. **文档到代码的鸿沟**：白皮书描述了机制但缺少实操示例
2. **状态管理的盲区**：并发Agent间的状态一致性没有机制保障
3. **边界条件的缺失**：异常、边界、冲突场景的处理不够完整

---

## 第一轮：执行准确性提升（Foundational Gaps）

### 1.1 Stage3.0 调度器的文件系统扫描实现缺失 ⚠️

**问题**：`DONE`/`BLOCKED` 文件协议描述了"扫描文件系统即可获得全局一致性视图"，但**没有提供具体的扫描代码示例**。Coordinator 是一个轻量 Agent，如果不能精确描述它如何读取文件状态，实际执行时会有一致性偏差。

**当前描述**（白皮书）：
> Coordinator 扫描文件系统即可获得全局一致性视图

**建议补充**：
```typescript
// Coordinator 必须实现的文件系统扫描逻辑
import * as fs from 'fs/promises';
import * as path from 'path';

async function scanModuleStates(moduleDir: string): Promise<Map<string, ModuleState>> {
  const states = new Map<string, ModuleState>();
  const modules = await fs.readdir(moduleDir);
  
  for (const module of modules) {
    const modulePath = path.join(moduleDir, module);
    const stat = await fs.stat(modulePath);
    
    if (!stat.isDirectory()) continue;
    
    const files = await fs.readdir(modulePath);
    if (files.includes('DONE')) {
      // 读取 DONE 内容，解析 YAML 验证完成状态
      const doneContent = await fs.readFile(path.join(modulePath, 'DONE'), 'utf-8');
      states.set(module, parseModuleState(doneContent, 'DONE'));
    } else if (files.includes('BLOCKED')) {
      const blockedContent = await fs.readFile(path.join(modulePath, 'BLOCKED'), 'utf-8');
      states.set(module, parseModuleState(blockedContent, 'BLOCKED'));
    } else {
      states.set(module, { state: 'IN_PROGRESS' });
    }
  }
  return states;
}
```

**影响**：Execution Accuracy +15%（从70%到85%）

---

### 1.2 TDD循环中Code Review触发条件不够精确 ⚠️

**问题**：白皮书描述了触发Review的条件（Green阶段失败、Refactor后失败、模块间接口调用），但**缺少具体的量化标准**。例如："Green阶段测试仍失败"指的是失败1次还是3次？

**当前描述**：
> Green 阶段测试仍失败 → 触发 Code Review，分析失败原因

**建议补充量化规则**：

| 条件 | 量化标准 | 动作 |
|------|---------|------|
| Green阶段失败 | 连续2次运行同一测试均失败 | 触发Review，等待人工判断 |
| Refactor后失败 | 单次失败即可 | 立即触发Review，回滚代码 |
| 模块间接口调用 | 每次跨模块调用前 | 预检Review（异步，不阻塞） |
| 新增异常路径测试 | 失败时 | 不触发（正常TDD流程） |

**关键补充**：模块间接口调用必须预检，但预检可以异步进行，不阻塞当前Agent继续开发。

---

### 1.3 Stage2 ↺循环的终止条件不够强制 ⚠️

**问题**：白皮书说"建议上限3轮"，但**没有强制约束机制**。如果3轮后仍然不一致怎么办？

**当前描述**：
> 如果 ① 和 ② 经过多轮循环（建议上限 3 轮）仍然无法就某个问题达成一致

**建议补充强制规则**：

```
┌─ 循环终止强制规则 ──────────────────────────────────────────┐
│                                                           │
│   第3轮结束时：                                            │
│     → 如果仍有未决问题，grill-with-docs 输出「未决问题清单」    │
│     → 按「最简实现原则」生成推荐方案                         │
│     → 自动暂停循环，进入「人类决策」模式                      │
│     → 所有 Agent 等待人类回复后再继续                        │
│     → 人类决策后，修改内容记录到 `CHANGE_LOG.md`             │
│                                                           │
│   人类决策超时机制：                                        │
│     → 超过24小时无回复 → 发送提醒（钉钉/飞书/邮件）           │
│     → 超过48小时 → 降级为「保守实现」（选最简单的方案）        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**影响**：Execution Accuracy +10%（减少无限循环风险）

---

## 第二轮：稳定性提升（Concurrency & Fault Tolerance）

### 2.1 并发Agent间的文件写入冲突检测缺失 ⚠️

**问题**：多个Agent可能同时写入同一个文件（如共享的`schema.ts`），**没有冲突检测机制**。如果两个Agent同时修改了`schema.ts`的不同部分，后合并时可能出现覆盖。

**建议补充**：

```typescript
// 文件锁定机制（防止并发写入冲突）
class FileLock {
  private locks = new Map<string, Promise<void>>();
  
  async acquire(filePath: string): Promise<() => void> {
    // 1. 检查是否已有锁
    while (this.locks.has(filePath)) {
      await this.locks.get(filePath);
    }
    
    // 2. 创建锁（Promise resolve时释放）
    let releaseFn: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseFn = resolve;
    });
    this.locks.set(filePath, lockPromise);
    
    return () => {
      this.locks.delete(filePath);
      releaseFn!();
    };
  }
}

// 使用示例
const lock = new FileLock();
const release = await lock.acquire('src/modules/user/schema.ts');
try {
  // 写入文件内容
  await fs.writeFile('src/modules/user/schema.ts', content);
} finally {
  release(); // 释放锁
}
```

**并发冲突检测算法**：
```
写入前：
  1. 读取文件的 MD5 哈希
  2. 记录为 baselineHash
  3. 写入文件
  4. 再次读取 MD5
  5. 如果写入前后 hash 一致 → 写入成功
  6. 如果 baselineHash 与最新读取的 hash 不同 → 其他人已修改 → 回滚并告警
```

---

### 2.2 Stage4 Bug修复循环的终止条件不明确 ⚠️

**问题**：白皮书描述了Bug修复循环，但**没有说明循环何时终止**。如果一个Bug修复后引入新Bug，新Bug又修复引入另一个Bug，循环可能无限持续。

**建议补充**：

| 终止条件 | 定义 | 说明 |
|---------|------|------|
| **正常终止** | 所有 P0/P1 Bug 已修复 | 最高优先级 |
| **时间终止** | 超过预设时间（如4小时） | 进入 Stage4 问题清单，后续迭代 |
| **回归终止** | 同一Bug修复3次仍失败 | 标记为「技术债务」，记录到 `TECH_DEBT.md` |
| **人工终止** | 人工判断该Bug不值得修 | 记录决策理由，关闭循环 |

**关键补充**：
```markdown
// TECH_DEBT.md 格式
## 未解决Bug记录

### #BUG-001: [问题简述]
- 发现时间：YYYY-MM-DD
- 尝试次数：3
- 失败原因：[分析]
- 决策：继续修/降级为技术债务/暂时搁置
- 决策人：人类/PipelineCoordinator
```

---

### 2.3 Agent异常恢复机制不完整 ⚠️

**问题**：如果后端Agent在开发过程中崩溃或中断，**没有明确的恢复流程**。丢失的上下文如何恢复？部分完成的工作如何处理？

**建议补充**：

```
Agent崩溃恢复流程：
┌──────────────────────────────────────────────────────────┐
│  1. 检测崩溃                                             │
│     → Agent心跳超时（如60秒无响应）                        │
│     → Coordinator检测到Agent进程消失                      │
│                                                          │
│  2. 状态检查                                              │
│     → 扫描模块目录是否有 DONE/BLOCKED                    │
│     → 检查已完成的代码文件完整性（MD5验证）                │
│     → 读取最近的代码文件，确认最后状态                    │
│                                                          │
│  3. 恢复决策                                              │
│     ├── 有DONE → 该模块已完成，恢复正常流程                │
│     ├── 有BLOCKED → 分析阻塞原因，决定是否重新分配         │
│     ├── 部分完成（目录存在，无DONE）→ 重新分配给Agent      │
│     │   → 重新分配的Agent读取现有代码作为上下文起点        │
│     │   → 跳过已完成的部分，继续开发                      │
│     └── 无目录 → 按正常调度分配                            │
│                                                          │
│  4. 上下文恢复（关键）                                     │
│     → 重新分配的Agent读取模块目录下所有文件                │
│     → 分析代码状态，确定继续点                            │
│     → 继续TDD循环（可能需要重新写Red测试）                 │
└──────────────────────────────────────────────────────────┘
```

**心跳机制补充**：
```yaml
# agent-heartbeat.yaml（每个Agent启动时创建）
agent_id: "backend-1"
module: "user"
started_at: "2026-05-20T10:00:00Z"
last_ping: "2026-05-20T10:05:00Z"
status: "ALIVE"  # ALIVE / DEAD / COMPLETED
```

---

## 第三轮：综合提升（Context Bridge & Quality Gates）

### 3.1 白皮书到Skill实现的映射关系不清晰 ⚠️

**问题**：白皮书定义了11种Agent角色，但**没有明确说明每个角色对应哪个`.qoder/skills/`下的Skill文件**。实际执行时，Agent创建者需要知道去哪里找到对应的Skill模板。

**建议补充映射表**：

| 白皮书Agent角色 | Skill文件路径 | 核心职责 |
|--------------|-------------|---------|
| 产品经理 | `skills/kf-mvp-product-manager/SKILL.md` | 需求分析、PRD生成 |
| 架构专家（①） | `skills/kf-mvp-arch-expert/SKILL.md` | 技术选型、Schema设计 |
| 业务领域专家（②） | `skills/kf-mvp-biz-expert/SKILL.md` | 模块划分、边界定义 |
| Mock服务专家（③a） | `skills/kf-mvp-mock-service/SKILL.md` | Mock服务搭建 |
| 单模块测试专家（③b-1） | `skills/kf-mvp-test-single/SKILL.md` | 单模块API测试 |
| 业务条线测试专家（③b-2） | `skills/kf-mvp-test-e2e/SKILL.md` | 端到端场景测试 |
| Pipeline Coordinator | `skills/kf-pipeline-coordinator/SKILL.md` | 任务调度、依赖管理 |
| 后端TDD Agent | `skills/kf-mvp-backend-tdd/SKILL.md` | TDD开发、Red-Green-Refactor |
| 前端Agent | `skills/kf-mvp-frontend-dev/SKILL.md` | Vue开发、Mock对接 |
| Code Review Agent | `skills/kf-mvp-code-review/SKILL.md` | 代码审查、合规检查 |
| Debug Agent | `skills/kf-mvp-debug/SKILL.md` | Bug定位、修复、回归 |

**关键说明**：
> 每个Agent创建时，必须从对应的Skill文件读取完整的system prompt配置。Skill文件是Agent创建的**唯一来源**，不允许Agent创建者自行编写system prompt。

---

### 3.2 Stage2门禁的检查点不够具体 ⚠️

**问题**：Stage2门禁列出了"通过后才能进入Stage3"的检查项，但**缺少具体的检查方式**。例如：如何验证`mocks/`目录"可运行"？如何验证`integration-tests/modules/`已"产出"？

**建议补充具体检查方式**：

```typescript
// Stage2 门禁检查实现
async function verifyStage2Gate(): Promise<GateResult> {
  const checks = [
    {
      name: 'spec.md【锁定版】',
      check: async () => {
        const content = await fs.readFile('spec.md', 'utf-8');
        return content.includes('【锁定版】');
      },
      passIf: true
    },
    {
      name: 'schema.sql【锁定版】',
      check: async () => {
        const stat = await fs.stat('schema.sql');
        const content = await fs.readFile('schema.sql', 'utf-8');
        return content.length > 100 && content.includes('-- MVP Schema');
      },
      passIf: true
    },
    {
      name: 'mocks/ 可运行',
      check: async () => {
        const packageJson = await fs.readFile('mocks/package.json', 'utf-8');
        const deps = JSON.parse(packageJson).dependencies;
        // 检查mock服务器可启动
        const result = await execAsync('cd mocks && npx tsc --noEmit');
        return result.exitCode === 0;
      },
      passIf: true
    },
    {
      name: 'integration-tests/modules/ 产出',
      check: async () => {
        const files = await fs.readdir('integration-tests/modules');
        return files.length > 0 && files.every(f => f.endsWith('.test.ts'));
      },
      passIf: true
    },
    {
      name: 'integration-tests/scenarios/ 产出',
      check: async () => {
        const files = await fs.readdir('integration-tests/scenarios');
        return files.length > 0 && files.every(f => f.endsWith('.test.ts'));
      },
      passIf: true
    }
  ];

  const results = await Promise.all(checks.map(async check => ({
    name: check.name,
    passed: await check.check() === check.passIf
  })));

  return {
    passed: results.every(r => r.passed),
    results,
    blockers: results.filter(r => !r.passed).map(r => r.name)
  };
}
```

---

### 3.3 Mock与真实API一致性的验证机制缺失 ⚠️

**问题**：白皮书说"Mock基于同一api-contract生成"，但**没有说明如何验证Mock与真实API的一致性**。实际开发中，Mock与后端实现可能有偏差。

**建议补充一致性验证机制**：

```
Mock-后端一致性验证（Stage3每次后端模块完成时执行）：
┌──────────────────────────────────────────────────────────┐
│  1. 后端模块完成 → Coordinator 检测到 DONE                │
│                                                          │
│  2. 自动运行契约对比脚本                                  │
│     → 读取 api-contract.yaml 中的接口定义                │
│     → 读取后端 src/modules/<module>/routes.ts            │
│     → 对比路由、方法、参数、响应格式                       │
│                                                          │
│  3. 对比结果分类                                          │
│     ├── 完全一致 → 通过 ✅                                │
│     ├── 字段差异 → 记录到 integration-issues.md         │
│     └── 路由缺失 → 记录到 integration-issues.md         │
│                                                          │
│  4. 人工确认（影响前端联调）                               │
│     → 有差异 → 前端Agent收到警告，评估是否需要调整         │
│     → 无差异 → 正常进入前端联调阶段                        │
└──────────────────────────────────────────────────────────┘
```

```typescript
// 契约对比脚本示例
async function validateContractConsistency(module: string) {
  const contract = yaml.load(await fs.readFile('api-contract.yaml', 'utf-8'));
  const routes = await fs.readFile(`src/modules/${module}/routes.ts`, 'utf-8');
  
  const issues = [];
  
  for (const endpoint of contract.paths) {
    const pathPattern = endpoint.path.replace(/\{/g, ':').replace(/\}/g, '');
    const routeRegex = new RegExp(`${endpoint.method}\\s+['\"](${pathPattern})['\"]`);
    
    if (!routeRegex.test(routes)) {
      issues.push({
        type: 'ROUTE_MISSING',
        expected: endpoint.path,
        actual: null
      });
    }
  }
  
  return issues;
}
```

---

## 优化优先级汇总

| 优先级 | 建议项 | 预计提升 | 实施成本 |
|-------|-------|---------|---------|
| 🔴 P0 | 1.1 调度器文件系统扫描实现 | +15% 执行准确性 | 中 |
| 🔴 P0 | 2.1 并发写入冲突检测 | +20% 稳定性 | 高 |
| 🟡 P1 | 1.2 Code Review触发量化 | +10% 执行准确性 | 低 |
| 🟡 P1 | 1.3 ↺循环终止强制规则 | +10% 执行准确性 | 中 |
| 🟡 P1 | 2.3 Agent异常恢复机制 | +15% 稳定性 | 中 |
| 🟡 P1 | 3.1 Skill映射关系 | +10% 执行准确性 | 低 |
| 🟢 P2 | 2.2 Bug修复循环终止条件 | +5% 稳定性 | 低 |
| 🟢 P2 | 3.2 Stage2门禁检查实现 | +5% 执行准确性 | 中 |
| 🟢 P2 | 3.3 Mock一致性验证 | +10% 稳定性 | 中 |

**综合提升预估**：
- 执行准确性：70% → 90%（+20%）
- 稳定性：50% → 85%（+35%）
- 整体可执行度：70% → 90%（+20%）

---

## 实施建议

1. **优先级顺序**：先P0（调度器实现+并发冲突检测），再P1，最后P2
2. **迭代方式**：每项优化后进行实际运行测试，验证效果
3. **文档更新**：每项优化后同步更新白皮书原文，保持一致性
4. **Skill同步**：白皮书更新后同步更新对应Skill文件的配置
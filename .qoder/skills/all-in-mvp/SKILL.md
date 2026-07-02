---
name: all-in-mvp
description: Load when user wants to build a full-stack MVP prototype using multi-agent parallel development pipeline. Triggers: MVP, 原型开发, 多Agent并行开发, 全栈快速原型, multi-agent pipeline, 从需求到交付, 多Agent流水线, 并行开发, 快速验证产品, 原型系统, 并行工程. NOT for: single API endpoint, bug fixing, code refactoring, deployment, code review alone.
metadata:
  pattern: pipeline+inversion+reviewer+generator
  stage-gates: true
  max-parallel-agents: 3
  based_on: MVP白皮书 v2.5.0
  platforms: [claude-code, qoder]
  workflow-ready: true
  workflow-scripts:
    - ".claude/workflows/stage1-prd.js"
    - ".claude/workflows/stage2-planning.js"
    - ".claude/workflows/stage3-execution.js"
    - ".claude/workflows/stage4-integration.js"
---

# Parallel MVP Pipeline — Multi-Platform 版

> 基于《MVP 白皮书 v2.5》的多 Agent 并行工程方法论。3 种运行模式、严格门禁、最大并行度。增量变更强制走完整流水线（§0.2决策树）。
> 支持 Claude Code（Dynamic Workflows）与 Qoder（Custom Subagents）双平台运行。

---

## 执行概览

```
【轻量模式】简单任务 → QuickStep1-3（单Agent直通，10-30min）
【全量模式】全新项目 → Stage1→Stage2→Stage3→Stage4（6-10 Agent，4-12h）
【增量模式】迭代项目 → 裁剪Stage执行（1-4h）
```

**黄金规则**：全量/增量模式下 Stage 不可跳过。轻量模式走简化通道（3 步替代 4 Stage）。

---

## Dynamic Workflow 执行模式（Claude Code 专有）

> **核心变化**：每个 Stage 对应一个独立的 Workflow 脚本（`.claude/workflows/*.js`），脚本自包含，prompt 内嵌，主 Agent 只需触发脚本并审查产出卡片。

### 主 Agent 角色转变

| 旧模式（手动 spawn） | 新模式（脚本驱动） |
|-------------------|---------------------|
| 主 Agent 逐个角色扮演，切换 context | 主 Agent = 指挥官，触发 Workflow + 审查产出卡片 |
| 子 Agent prompt 靠主 Agent 对话切换 | 子 Agent 在 Workflow 脚本内独立运行 |
| 所有中间状态在主会话上下文累积 | 中间状态在 Workflow 内隔离，主会话始终干净 |
| 中断后只能重来 | Workflow 支持 `resumeFromRunId` 断点续跑 |
| 最大并行度靠主 Agent 手动管理 | Workflow 自动按依赖图 fan-out |

### Workflow 触发时机

```
用户需求进入 → 主 Agent 判定模式（轻量/全量/增量）
    │
    ├── 轻量模式 → 主 Agent 直接执行 QuickStep1-3（不触发 Workflow）
    │
    └── 全量/增量模式 → 主 Agent 依次触发 Workflow：
          Workflow({ scriptPath: '.claude/workflows/stage1-prd.js', args: {...} })
          → Workflow({ scriptPath: '.claude/workflows/stage2-planning.js', args: {...} })
          → Workflow({ scriptPath: '.claude/workflows/stage3-execution.js', args: {...} })
          → Workflow({ scriptPath: '.claude/workflows/stage4-integration.js', args: {...} })
          每个 Workflow 完成后，主 Agent 审查产出卡片，确认门禁通过，再触发下一个
```

### Workflow 脚本架构

4 个脚本各自自包含，不依赖运行时读取 `agents/*.md` 文件（prompt 内嵌模板字符串）：

```
.claude/workflows/
├── stage1-prd.js          ← PM Agent (pro) → PRD.md
├── stage2-planning.js     ← Architect(pro) + Domain Expert(flash) + Grill(pro) + Mock/Test(flash)
├── stage3-execution.js    ← Coordinator(flash) + Backend/Frontend(flash) + Code Reviewer(pro)
└── stage4-integration.js  ← Stage4 Coord(pro) + Merge/Integration/Test(flash) + Debug(flash)
```

### 如何触发 Workflow

**方式一（推荐）**：直接调用脚本
```javascript
// Stage1: 需求对齐
Workflow({ scriptPath: '.claude/workflows/stage1-prd.js', args: { userRequirement: '用户需求', context: '业务背景' } })

// Stage2: 规划校验
Workflow({ scriptPath: '.claude/workflows/stage2-planning.js', args: { prdPath: 'PRD.md' } })

// Stage3: 并行开发
Workflow({ scriptPath: '.claude/workflows/stage3-execution.js', args: { taskPath: 'task.md', modulesDir: 'modules/' } })

// Stage4: 集成验收
Workflow({ scriptPath: '.claude/workflows/stage4-integration.js', args: { srcDir: 'src/', mockDir: 'mocks/' } })
```

**方式二**：开启 ultracode 模式后直接描述任务
> "Build a [项目描述] using the all-in-mvp pipeline"

---

### Workflow自愈机制（v2.6 新增）

> **目标**：提升one-shot能力，减少人工干预。Workflow失败时自动重试、降级或断点续跑。

#### 1. Workflow失败自动重试

```javascript
// Workflow脚本内部重试机制
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function executeWithRetry(taskFn, taskName) {
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await taskFn();
    } catch (error) {
      lastError = error;
      console.warn(`[Workflow] ${taskName} 失败 (尝试 ${attempt}/${MAX_RETRIES}): ${error.message}`);
      
      if (attempt < MAX_RETRIES) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        
        // 清理可能的中间状态
        await cleanupIntermediateState(taskName);
      }
    }
  }
  
  // 所有重试失败，标记BLOCKED
  throw new Error(`[Workflow] ${taskName} 在 ${MAX_RETRIES} 次尝试后仍然失败: ${lastError.message}`);
}

// 使用示例
const result = await executeWithRetry(
  () => executeBackendModule(module),
  `backend-${module.name}`
);
```

#### 2. 模块开发失败自动降级

```javascript
// 模块开发失败处理策略
const MODULE_FAILURE_STRATEGIES = {
  // 策略1: 重试（默认）
  retry: {
    maxAttempts: 3,
    condition: (error) => error.type === 'TRANSIENT' // 临时性错误
  },
  
  // 策略2: 降级为简化实现
  degrade: {
    condition: (error) => error.type === 'COMPLEXITY' && error.module.complexity > 8,
    action: async (module) => {
      // 简化模块实现
      await simplifyModuleImplementation(module);
      // 标记为降级版本
      await markModuleAsDegraded(module);
    }
  },
  
  // 策略3: 标记BLOCKED，继续其他模块
  block: {
    condition: (error) => error.type === 'DEPENDENCY' || error.type === 'CONTRACT',
    action: async (module, error) => {
      await markModuleAsBlocked(module, error.message);
      // 通知Coordinator
      await notifyCoordinator('MODULE_BLOCKED', { module, error });
    }
  },
  
  // 策略4: 降级为人工开发
  humanFallback: {
    condition: (error) => error.attempt >= 3 && error.type === 'PERSISTENT',
    action: async (module) => {
      await markModuleAsHumanFallback(module);
      await notifyHuman('MODULE_HUMAN_FALLBACK', { module });
    }
  }
};

async function handleModuleFailure(module, error) {
  // 根据错误类型选择策略
  const strategy = Object.entries(MODULE_FAILURE_STRATEGIES)
    .find(([_, config]) => config.condition(error));
  
  if (strategy) {
    const [strategyName, config] = strategy;
    console.log(`[Workflow] 模块 ${module.name} 失败，采用策略: ${strategyName}`);
    await config.action(module, error);
  } else {
    // 默认标记BLOCKED
    await markModuleAsBlocked(module, error.message);
  }
}
```

#### 3. Stage间断点续跑

```javascript
// 断点续跑机制
async function resumeWorkflowFromCheckpoint(workflowId) {
  // 1. 读取上次执行状态
  const checkpoint = await loadCheckpoint(workflowId);
  
  if (!checkpoint) {
    console.log('[Workflow] 无检查点，从头开始执行');
    return await executeWorkflowFromStart(workflowId);
  }
  
  console.log(`[Workflow] 从检查点恢复: Stage ${checkpoint.stage}, 步骤 ${checkpoint.step}`);
  
  // 2. 验证检查点有效性
  const isValid = await validateCheckpoint(checkpoint);
  if (!isValid) {
    console.warn('[Workflow] 检查点无效，从头开始执行');
    return await executeWorkflowFromStart(workflowId);
  }
  
  // 3. 恢复执行
  return await resumeFromCheckpoint(checkpoint);
}

// 检查点数据结构
const checkpointSchema = {
  workflowId: 'string',
  stage: 'number', // 1-4
  step: 'string',  // 当前步骤标识
  startedAt: 'ISO8601',
  lastSavedAt: 'ISO8601',
  completedModules: ['string'], // 已完成的模块列表
  pendingModules: ['string'],   // 待处理的模块列表
  blockedModules: [{            // 阻塞的模块
    name: 'string',
    reason: 'string',
    blockedAt: 'ISO8601'
  }],
  artifacts: {                  // 已产出的产物
    prd: 'path/to/PRD.md',
    spec: 'path/to/spec.md',
    // ...
  },
  metrics: {                    // 执行指标
    totalModules: 'number',
    completedCount: 'number',
    failedCount: 'number',
    retryCount: 'number'
  }
};

// 保存检查点
async function saveCheckpoint(workflowId, state) {
  const checkpoint = {
    workflowId,
    stage: state.currentStage,
    step: state.currentStep,
    startedAt: state.startedAt,
    lastSavedAt: new Date().toISOString(),
    completedModules: state.completedModules,
    pendingModules: state.pendingModules,
    blockedModules: state.blockedModules,
    artifacts: state.artifacts,
    metrics: state.metrics
  };
  
  // 原子写入（先写临时文件，再重命名）
  const tempPath = `checkpoints/${workflowId}.tmp`;
  const finalPath = `checkpoints/${workflowId}.json`;
  
  await writeFile(tempPath, JSON.stringify(checkpoint, null, 2));
  await rename(tempPath, finalPath);
  
  console.log(`[Workflow] 检查点已保存: Stage ${checkpoint.stage}, Step ${checkpoint.step}`);
}

// 定期保存检查点（每完成一个模块）
async function onModuleCompleted(workflowId, moduleName) {
  // 更新状态
  state.completedModules.push(moduleName);
  state.pendingModules = state.pendingModules.filter(m => m !== moduleName);
  state.metrics.completedCount++;
  
  // 保存检查点
  await saveCheckpoint(workflowId, state);
}
```

#### 4. 自愈机制配置

```javascript
// Workflow自愈配置
const WORKFLOW_SELF_HEALING_CONFIG = {
  // 重试配置
  retry: {
    maxAttempts: 3,
    delayMs: 5000,
    backoffMultiplier: 2, // 指数退避
    retryableErrors: ['TRANSIENT', 'TIMEOUT', 'NETWORK']
  },
  
  // 降级配置
  degradation: {
    enabled: true,
    complexityThreshold: 8, // 复杂度超过8时考虑降级
    preserveCore: true,    // 保留核心功能
    skipNonEssential: true // 跳过非必要功能
  },
  
  // 断点续跑配置
  checkpoint: {
    enabled: true,
    saveInterval: 'per-module', // 每完成一个模块保存
    maxCheckpoints: 10,         // 最多保留10个检查点
    autoCleanup: true           // 自动清理旧检查点
  },
  
  // 超时配置
  timeout: {
    perModule: 30 * 60 * 1000,  // 单模块30分钟
    perStage: 4 * 60 * 60 * 1000, // 单Stage 4小时
    totalWorkflow: 12 * 60 * 60 * 1000 // 整个Workflow 12小时
  },
  
  // 告警配置
  alerts: {
    retryThreshold: 2,      // 重试超过2次告警
    degradationNotify: true, // 降级时通知
    timeoutWarning: 0.8      // 超时80%时警告
  }
};
```

---

## 强制沟通协议（v2.7 新增）

> **借鉴 manual-driving 项目的沟通能力，强化 Agent 与用户的认知同步。**
> **核心思想**：Agent 不替用户做决策。Agent 负责分析、整理、建议——用户负责决策。

### 1. 反转控制（IoC）核心原则

| 维度 | 传统模式（自动驾驶） | 强化模式（手动驾驶） |
|------|-------------------|-------------------|
| 问题数量 | 限制 1-3 个关键问题 | **不限数量**，有多少不清楚的就问多少 |
| 决策权 | Agent 自行选择方案 | Agent 列出方案+利弊，**用户选择** |
| 假设处理 | Agent 自行假设并记录 | **禁止自行假设**，必须向用户确认 |
| 认知同步 | 无显式同步节点 | **每个环节结束前强制同步** |
| 产出物 | Agent 直接产出最终版 | Agent 产出草案 → 用户确认 → 锁定 |

---

### 2. 强制问答协议（MQAP）

每一个 Pipeline 环节必须执行此协议：

```
Step 1: Agent 阅读输入（PRD/spec/需求变更）
Step 2: Agent 列出「理解确认清单」
        ├── 我理解的需求是：<用自己的话复述>
        ├── 我认为的边界是：<范围、不做清单>
        └── 我发现以下不清楚的点：<逐项列出>
Step 3: 用户审阅 → ✅同意继续 / ⚠️驳回调整
Step 4: Agent 输出「卡片式执行计划」(CEP)
        ├── 🔭 全面性：覆盖了什么、没覆盖什么
        ├── ⚠️ 难点：关键难点+风险评估+替代预案
        └── 🧭 主线计划：执行步骤+依赖关系+里程碑
Step 5: 用户审阅卡片 → ✅同意继续 / ⚠️驳回调整
Step 6: Agent 记录 Q&A + 卡片到环节决策日志
Step 7: Agent 基于确认后的理解和计划执行
Step 8: Agent 输出草案
Step 9: Agent 列出「产出物确认清单」
        ├── 我产出了什么
        ├── 关键决策+理由
        ├── 对照卡片：实际产出 vs 计划的差异
        └── 需要重点审阅的风险点
Step 10: 用户审阅产出物 → ✅锁定 / ⚠️驳回重做(RRR)
```

**关键约束**：Step 2 中「不清楚的点」不允许留空。沉默的假设是最危险的。

### 3. 提问格式规范

Agent 向用户提问时，遵循以下格式：

```markdown
## 需要你确认/澄清的事项

### 关于 <主题>
**我的理解**：<Agent 对这部分的理解>
**我不确定的点**：
1. <具体问题> — 为什么问这个：<上下文说明>
**我的建议**（如有）：<推荐方案 + 理由>
```

### 4. 回答的记录规范

用户的每一个回答都必须**完整记录**到决策日志：

| 不可接受 | 必须做到 |
|---------|--------|
| "用户说要支持登录" | 记录完整信息：角色、权限、登录方式、不需要的功能等 |
| "用户选择了方案A" | 记录：方案A（JWT Token）+ 拒绝方案B（Session）+ 理由 |
| 口头确认不记录 | 即使用户口头说"可以"，也必须记录：`用户确认：✅通过` |

---

### 5. 卡片式执行计划（CEP）

每个环节在理解确认后、动手执行前，Agent 必须输出一张执行计划卡片：

```
┌─────────────────────────────────────────────┐
│  📋 <环节名称> 执行计划卡片                    │
│                                              │
│  🔭 全面性 — 覆盖了什么？                      │
│  ├── 覆盖范围：<本环节要产出的所有内容>          │
│  ├── 不覆盖：<明确不做的内容+理由>              │
│  └── 与上/下游的关系：<输入来自哪，输出给谁>      │
│                                              │
│  ⚠️ 难点 — 哪里最可能出问题？                   │
│  ├── 技术难点：<1-3个关键技术挑战>              │
│  ├── 业务难点：<1-3个业务逻辑复杂点>            │
│  ├── 风险等级：🟢低 / 🟡中 / 🔴高              │
│  └── 每难点的替代预案：<如果卡住了怎么做>        │
│                                              │
│  🧭 主线计划 — 按什么顺序推进？                 │
│  ├── 执行步骤：<第一步→第二步→...→完成>         │
│  ├── 依赖项：<需要等待谁/什么先完成>            │
│  ├── 里程碑：<什么时候产出什么中间产物>          │
│  └── 预计耗时：<整个环节需要多久>               │
│                                              │
│  ❓ 待确认事项：<仍需用户回答的问题>             │
└─────────────────────────────────────────────┘
```

**三条铁律**：
1. **不超过一张屏**：用户在 30 秒内能读完
2. **先说"不做什么"**：边界不清是认知漂移的第一来源
3. **每个难点必须有预案**：不允许只说"这里难"

---

### 6. 驳回-修正-重审循环（RRR）

```
1. 用户驳回，给出驳回意见（必须指明：驳回什么、为什么、期望方向）
2. Agent 读取驳回意见，逐条理解
3. Agent 输出「驳回响应」：修正后的理解 + 调整后的方案 + 连带影响
4. Agent 修正产出物/计划
5. Agent 重新摆出（回到 MQAP 对应 Step）
6. 用户重新审阅 → ✅通过 / ⚠️再次驳回
```

| 驳回次数 | 状态 | 处理方式 |
|---------|------|--------|
| 第 1 次 | 正常 | Agent 按驳回意见调整后重交 |
| 第 2 次 | 关注 | 附"与前次驳回的差异对照" |
| 第 3 次 | 警告 | 输出「未对齐清单」，分析根因 |
| 第 3 次后仍未通过 | 升级 | 标记 `BLOCKED(human-review)`，上浮人类全量审查 |

**驳回类型**：理解驳回 / 覆盖驳回 / 方案驳回 / 产出驳回 / 部分驳回

---

### 7. 认知同步检查点（不可跳过）

| 检查点 | 位置 | 同步内容 | 通过条件 |
|--------|------|---------|--------|
| CP-1 | Stage1 完成后 | PRD 理解一致性 | 用户同意 PRD 准确反映需求 |
| CP-2 | Stage2 ①完成后 | 架构理解一致性 | 用户同意 spec/schema/api-contract |
| CP-3 | Stage2 ②完成后 | 模块划分一致性 | 用户同意模块拆分合理 |
| CP-4 | ↺循环通过后 | 交叉校验结果 | 审查问题已全部修正 |
| CP-5 | Stage2 ③完成后 | Mock/测试覆盖 | Mock数据和测试场景完整 |
| CP-6 | 每个后端模块 DONE | 模块实现一致性 | 用户同意模块实现符合预期 |
| CP-7 | 每个前端页面完成 | 页面实现一致性 | 用户同意页面交互符合预期 |
| CP-8 | Stage4 集成完成 | 整体交付一致性 | 用户同意交付满足验收标准 |

---

### 8. 决策日志系统

每个 Pipeline 环节产出：`decisions/<阶段>-<环节>-decisions.md`

#### 目录结构
```
decisions/
  ├── stage1-prd-decisions.md
  ├── stage2-arch-decisions.md
  ├── stage2-biz-decisions.md
  ├── stage2-grill-decisions.md
  ├── stage2-mock-decisions.md
  ├── stage2-test-decisions.md
  ├── stage3-backend-<module>-decisions.md
  ├── stage3-frontend-<page>-decisions.md
  ├── stage4-integration-decisions.md
  └── stage5-retro-decisions.md
```

#### 日志包含
- 理解确认阶段（Agent 复述 + 用户确认）
- 执行计划卡片（全面性 + 难点 + 主线）
- 决策记录（候选方案 + 选择 + 理由 + 用户确认）
- 产出物确认（产出物 + 风险 + 差异 + 用户确认）
- 驳回与修正记录（RRR 轮次 + 驳回意见 + 响应 + 连带影响）
- 环节门禁 checklist

#### 决策复议（下游 Agent 质疑上游决策）

下游 Agent 如果对上游决策有疑问，**不直接修改**，而是：

```
1. 在决策日志中新增一条「决策复议」记录
2. 说明为什么现有决策可能有问题
3. 列出替代方案
4. 等待用户裁决
```

> 决策可追溯性链：问题 → 用户回答 → Agent 决策 → 决策记录 → 下游引用决策编号

---

### 9. 上下文隔离策略

| 规则 | 说明 |
|------|------|
| Agent 间不直接通信 | 通过文件读取，不直接对话 |
| 禁止共享未锁定产出物 | 非 `.locked.md` 不得被其他 Agent 读取 |
| 禁止共享对话历史 | Agent B 只读取决策日志中的**结论** |
| 禁止共享内部推理 | 只写结论+理由，不暴露中间推理 |
| 决策日志是唯一跨环节载体 | 下游通过 `decisions/*.md` 了解人类决策 |

#### 上下文传递规范

```
Agent A 产出 → Agent B 接收：
  ├── 锁定版产出物（spec.md / module.md 等）
  ├── 决策日志（只读结论，不读中间推理）
  └── 上下文摘要（≤500 字）
```

---

### 10. 沟通质量指标

| 指标 | 计算方式 | 目标值 |
|------|---------|--------|
| 认知同步覆盖率 | 通过用户确认的检查点数 / 强制检查点总数 | = 100% |
| 提问充分度 | Agent 实际提问数 / 后续环节发现的理解偏差数 | ≥ 3 |
| 决策记录完整率 | 有决策日志的环节数 / 总环节数 | = 100% |
| 用户决策参与率 | 用户直接参与的决策数 / 总决策数 | ≥ 80% |
| 首次同意率 | 一次确认即 ✅ 的检查点数 / 总检查点数 | ≥ 50% |
| 平均驳回轮次 | 各检查点 RRR 轮次之和 / 被驳回的检查点数 | ≤ 1.5 |
| 驳回升级率 | 达到3轮驳回升级的检查点数 / 总检查点数 | ≤ 10% |

---

## 快速通道：简单任务判定（进入流水线前执行）

> **在执行完整流水线之前，先判定任务复杂度。简单任务走轻量通道，避免不必要的 Workflow 开销。**

### 判定流程

```
用户需求进入
    ↓
评估以下 7 个维度：
  1. API/接口数量 ≤2？
  2. 无数据库 或 单表 CRUD？
  3. 单用户角色（无登录/单一类型）？
  4. 无状态流转（单状态）？
  5. 单页面 或 2 个简单页面？
  6. 无外部服务调用？
  7. 仅 1 个全栈模块？
    ↓
满足 ≥3 项 → 轻量模式（3 步直通车，主 Agent 直接执行，不触发 Workflow）
不满足     → 全量/增量模式（触发完整 Workflow 流水线）
```

### 轻量模式 QuickStep 1-3

```
QuickStep1: 需求摘要
    ├── 输出：需求卡片 + 技术摘要（单个 .md，YAML front matter）
    ├── 不产生：PRD.md / spec.md / schema.sql / api-contract.yaml / task.md
    └── 耗时：2-5min
    ↓
QuickStep2: 直接开发
    ├── 单 Agent 全栈开发（后端+前端一起写）
    ├── 无 Coordinator、无 Mock、无模块拆分
    ├── 可选 L1 单元测试（按需）
    └── 耗时：5-20min
    ↓
QuickStep3: 轻量验收
    ├── 运行 + 冒烟测试
    ├── 用户确认可用
    └── 耗时：2-5min
```

### 需求卡片模板

```yaml
# @task: <一句话任务描述>
# @type: simple
# @tech: <html+css+js | hono+sqlite | vue+vite | ...>
# @apis: <API端点列表，无则写 none>
# @db: <数据表，无则写 none>
# @pages: <页面列表>
# @acceptance: <1-2条验收标准>
```

**典型简单任务**：个人博客、落地页、留言板、JSON API 代理、单表 CRUD、Markdown 预览器。

### 轻量→全量升级

开发中发现以下情况应升级为全量模式：
- 需要 ≥3 个 API 端点
- 需要多表关联/事务
- 用户追加需求导致模块 ≥2
- 需要多角色权限

> 升级时保留已产出代码，补充执行全量 Stage1→Stage2 Workflow。

### 轻量模式自动升级机制（v2.7 新增）

> **目标**：在轻量模式执行中自动检测复杂度，超出阈值时自动升级为全量模式，减少人工干预。

#### 1. 复杂度自动检测

```javascript
// 复杂度检测器（QuickStep2 开发过程中实时监控）
const COMPLEXITY_MONITOR = {
  // 检测维度及阈值
  dimensions: {
    apiEndpoints: {
      threshold: 3,
      current: 0,
      detect: (code) => {
        // 扫描代码中的 API 端点定义
        const routes = code.match(/app\.(get|post|put|delete|patch)\(/g);
        return routes ? routes.length : 0;
      }
    },
    
    databaseTables: {
      threshold: 2,
      current: 0,
      detect: (code) => {
        // 扫描 Drizzle schema 定义
        const tables = code.match(/sqliteTable\(/g);
        return tables ? tables.length : 0;
      }
    },
    
    userRoles: {
      threshold: 2,
      current: 0,
      detect: (code) => {
        // 扫描角色相关代码
        const roles = code.match(/role.*?:\s*['"]([^'"]+)['"]/g);
        const uniqueRoles = [...new Set(roles)];
        return uniqueRoles.length;
      }
    },
    
    modules: {
      threshold: 2,
      current: 0,
      detect: (code, files) => {
        // 统计独立功能模块数
        const moduleDirs = files.filter(f => 
          f.includes('/modules/') && 
          f.endsWith('/index.ts')
        );
        return moduleDirs.length;
      }
    },
    
    stateTransitions: {
      threshold: 3,
      current: 0,
      detect: (code) => {
        // 扫描状态机相关代码
        const transitions = code.match(/status.*?=>.*?/g);
        return transitions ? transitions.length : 0;
      }
    }
  },
  
  // 综合复杂度评分
  calculateScore() {
    let score = 0;
    let exceeded = [];
    
    for (const [key, dim] of Object.entries(this.dimensions)) {
      if (dim.current > dim.threshold) {
        score += (dim.current - dim.threshold) * 2;
        exceeded.push({ dimension: key, current: dim.current, threshold: dim.threshold });
      }
    }
    
    return { score, exceeded };
  },
  
  // 检查是否需要升级
  shouldUpgrade() {
    const { score, exceeded } = this.calculateScore();
    return {
      upgrade: score >= 2 || exceeded.length >= 2,
      score,
      exceeded,
      reason: exceeded.length > 0 
        ? `以下维度超出阈值：${exceeded.map(e => `${e.dimension}(${e.current}/${e.threshold})`).join(', ')}`
        : '复杂度评分正常'
    };
  }
};
```

#### 2. 自动升级触发器

```javascript
// QuickStep2 执行过程中的自动升级检查点
const UPGRADE_CHECKPOINTS = {
  // 检查点1：初始代码生成后
  afterInitialCode: {
    timing: '代码骨架生成完成',
    check: async (code, files) => {
      // 更新检测维度
      COMPLEXITY_MONITOR.dimensions.apiEndpoints.current = 
        COMPLEXITY_MONITOR.dimensions.apiEndpoints.detect(code);
      COMPLEXITY_MONITOR.dimensions.databaseTables.current = 
        COMPLEXITY_MONITOR.dimensions.databaseTables.detect(code);
      
      return COMPLEXITY_MONITOR.shouldUpgrade();
    }
  },
  
  // 检查点2：功能扩展时
  onFeatureExpansion: {
    timing: '用户追加新需求或功能',
    check: async (newRequirements) => {
      // 分析新需求
      const analysis = analyzeRequirements(newRequirements);
      
      // 更新模块数
      COMPLEXITY_MONITOR.dimensions.modules.current += analysis.newModules;
      
      // 更新角色数
      if (analysis.newRoles) {
        COMPLEXITY_MONITOR.dimensions.userRoles.current += analysis.newRoles.length;
      }
      
      return COMPLEXITY_MONITOR.shouldUpgrade();
    }
  },
  
  // 检查点3：错误累积时
  onErrorAccumulation: {
    timing: '连续错误超过阈值',
    check: async (errorHistory) => {
      // 错误可能暗示复杂度超出轻量模式能力
      const recentErrors = errorHistory.slice(-5);
      const complexityErrors = recentErrors.filter(e => 
        e.type === 'COMPLEXITY' || 
        e.type === 'DEPENDENCY' || 
        e.type === 'INTEGRATION'
      );
      
      return {
        upgrade: complexityErrors.length >= 3,
        reason: `最近5个错误中有${complexityErrors.length}个复杂度相关错误`
      };
    }
  }
};

// 自动升级执行器
async function executeAutoUpgrade(reason, currentProgress) {
  console.log(`[轻量模式] 检测到需要升级：${reason}`);
  console.log(`[轻量模式] 当前进度：${JSON.stringify(currentProgress)}`);
  
  // 1. 保存当前产出
  const preservedArtifacts = await preserveCurrentArtifacts(currentProgress);
  console.log(`[轻量模式] 已保存当前产出：${preservedArtifacts.length} 个文件`);
  
  // 2. 生成升级报告
  const upgradeReport = {
    timestamp: new Date().toISOString(),
    reason,
    currentProgress,
    preservedArtifacts,
    nextSteps: [
      '执行 Stage1 Workflow（PRD 生成）',
      '执行 Stage2 Workflow（架构规划）',
      '基于已有代码继续 Stage3 开发'
    ]
  };
  
  // 3. 通知用户并请求确认
  await notifyUserUpgrade(upgradeReport);
  
  return upgradeReport;
}

// 保存当前产出（不丢弃已有工作）
async function preserveCurrentArtifacts(progress) {
  const artifacts = [];
  
  // 保存已生成的代码文件
  for (const file of progress.generatedFiles) {
    const backupPath = `backups/lightweight/${file.path}`;
    await copyFile(file.path, backupPath);
    artifacts.push({ type: 'code', path: file.path, backupPath });
  }
  
  // 保存需求理解
  if (progress.requirementSummary) {
    const summaryPath = 'backups/lightweight/requirement-summary.md';
    await writeFile(summaryPath, progress.requirementSummary);
    artifacts.push({ type: 'requirement', path: summaryPath });
  }
  
  // 保存技术决策
  if (progress.techDecisions) {
    const decisionsPath = 'backups/lightweight/tech-decisions.json';
    await writeFile(decisionsPath, JSON.stringify(progress.techDecisions, null, 2));
    artifacts.push({ type: 'decisions', path: decisionsPath });
  }
  
  return artifacts;
}
```

#### 3. 升级后执行流程

```javascript
// 升级为全量模式后的执行流程
async function executeFullModeAfterUpgrade(upgradeReport) {
  console.log('[全量模式] 开始从轻量模式升级后的执行流程');
  
  // Stage1: 使用已有需求理解生成 PRD
  const prdWorkflow = await Workflow({
    scriptPath: '.claude/workflows/stage1-prd.js',
    args: {
      userRequirement: upgradeReport.currentProgress.userRequirement,
      context: upgradeReport.currentProgress.requirementSummary,
      existingCode: upgradeReport.preservedArtifacts.filter(a => a.type === 'code'),
      mode: 'upgrade_from_lightweight'
    }
  });
  
  // Stage2: 使用已有技术决策进行架构规划
  const planningWorkflow = await Workflow({
    scriptPath: '.claude/workflows/stage2-planning.js',
    args: {
      prdPath: 'PRD.md',
      existingDecisions: upgradeReport.currentProgress.techDecisions,
      preservedModules: upgradeReport.preservedArtifacts.filter(a => a.type === 'code'),
      mode: 'upgrade_from_lightweight'
    }
  });
  
  // Stage3: 基于已有代码继续开发
  const executionWorkflow = await Workflow({
    scriptPath: '.claude/workflows/stage3-execution.js',
    args: {
      taskPath: 'task.md',
      modulesDir: 'modules/',
      existingCode: upgradeReport.preservedArtifacts.filter(a => a.type === 'code'),
      mode: 'upgrade_from_lightweight'
    }
  });
  
  return {
    prdWorkflow,
    planningWorkflow,
    executionWorkflow,
    message: '升级完成，已基于轻量模式产出继续全量开发'
  };
}
```

#### 4. 升级保护机制

```javascript
// 升级保护配置
const UPGRADE_PROTECTION = {
  // 防止频繁升级
  cooldown: {
    duration: 5 * 60 * 1000, // 5分钟冷却期
    lastUpgrade: null,
    canUpgrade() {
      if (!this.lastUpgrade) return true;
      return Date.now() - this.lastUpgrade > this.duration;
    },
    recordUpgrade() {
      this.lastUpgrade = Date.now();
    }
  },
  
  // 升级确认（避免误判）
  confirmation: {
    required: true,
    timeout: 30000, // 30秒超时
    async requestConfirmation(upgradeReport) {
      console.log('[升级确认] 检测到以下复杂度指标：');
      console.log(upgradeReport.reason);
      console.log('[升级确认] 是否升级为全量模式？(30秒内无响应将自动升级)');
      
      // 实际实现中这里会等待用户输入
      // 简化示例：假设用户确认
      return true;
    }
  },
  
  // 进度保护
  progressProtection: {
    minimumProgress: 0.3, // 至少完成30%才允许升级（避免浪费）
    checkProgress(progress) {
      const completionRate = progress.completedTasks / progress.totalTasks;
      if (completionRate < this.minimumProgress) {
        console.warn(`[升级保护] 当前进度仅${(completionRate * 100).toFixed(1)}%，建议继续轻量模式`);
        return false;
      }
      return true;
    }
  }
};

// 带保护的升级检查
async function checkAndUpgradeWithProtection(currentProgress) {
  // 检查冷却期
  if (!UPGRADE_PROTECTION.cooldown.canUpgrade()) {
    console.log('[升级保护] 冷却期内，跳过升级检查');
    return null;
  }
  
  // 检查进度
  if (!UPGRADE_PROTECTION.progressProtection.checkProgress(currentProgress)) {
    return null;
  }
  
  // 执行复杂度检测
  const upgradeCheck = COMPLEXITY_MONITOR.shouldUpgrade();
  if (!upgradeCheck.upgrade) {
    return null;
  }
  
  // 请求确认
  if (UPGRADE_PROTECTION.confirmation.required) {
    const confirmed = await UPGRADE_PROTECTION.confirmation.requestConfirmation({
      reason: upgradeCheck.reason,
      currentProgress
    });
    if (!confirmed) {
      console.log('[升级保护] 用户取消升级');
      return null;
    }
  }
  
  // 记录升级时间
  UPGRADE_PROTECTION.cooldown.recordUpgrade();
  
  // 执行升级
  return await executeAutoUpgrade(upgradeCheck.reason, currentProgress);
}
```

#### 5. 升级配置

```javascript
// 轻量模式自动升级配置
const LIGHTWEIGHT_AUTO_UPGRADE_CONFIG = {
  // 是否启用自动升级
  enabled: true,
  
  // 检测频率
  detectionFrequency: {
    onCodeGeneration: true,      // 代码生成时检测
    onFeatureExpansion: true,    // 功能扩展时检测
    onErrorAccumulation: true,   // 错误累积时检测
    periodicCheck: false         // 不做定时检测（避免干扰）
  },
  
  // 升级阈值
  thresholds: {
    apiEndpoints: 3,            // API端点数阈值
    databaseTables: 2,          // 数据库表数阈值
    userRoles: 2,               // 用户角色数阈值
    modules: 2,                 // 模块数阈值
    stateTransitions: 3,        // 状态转换数阈值
    complexityScore: 2,         // 综合复杂度评分阈值
    errorRate: 0.3              // 错误率阈值（30%）
  },
  
  // 升级行为
  behavior: {
    preserveCode: true,         // 保留已有代码
    askConfirmation: true,      // 询问用户确认
    autoBackup: true,           // 自动备份
    generateReport: true        // 生成升级报告
  },
  
  // 日志配置
  logging: {
    enabled: true,
    level: 'info',              // debug | info | warn | error
    logFile: 'logs/lightweight-upgrade.log'
  }
};
```

#### 6. 升级报告模板

```markdown
# 轻量模式升级报告

## 升级原因
- **检测时间**：<ISO 8601>
- **触发条件**：<具体超出阈值的维度>
- **复杂度评分**：<分数>

## 当前进度
- **已完成任务**：<数量>
- **总任务数**：<数量>
- **完成率**：<百分比>
- **已生成文件**：<列表>

## 保留的产出
- **代码文件**：<数量> 个
- **需求摘要**：<有/无>
- **技术决策**：<有/无>

## 升级后计划
1. 执行 Stage1 Workflow（PRD 生成）
2. 执行 Stage2 Workflow（架构规划）
3. 基于已有代码继续 Stage3 开发
4. 执行 Stage4 集成验收

## 用户确认
- [ ] 确认升级为全量模式
- [ ] 保留当前所有产出
- [ ] 继续执行全量流水线
```

---

## 门禁系统（硬约束）

```
     Stage1 完成 → PRD.md 已锁定
         ↓
     Stage2 完成 → schema.sql / api-contract / module docs 全部锁定
         ↓
     Stage3 完成 → 后端全模块 DONE + 前端全页面 DONE + 单元测试全通过
         ↓
     Stage4 完成 → 集成测试通过率 100%
```

任何阶段的产出物变更必须走变更评审——下游 Agent 不自行修改上游锁定产出物。

---

## Stage 1: 需求对齐 — Workflow(`.claude/workflows/stage1-prd.js`)

**前置条件**：用户需求已收集（如果模糊则先执行 Inversion 采集）。
**产出物**：`PRD.md` + `decisions/stage1-prd-decisions.md`
**执行方式**：触发 Workflow 脚本（串行，单子任务）
**模型**：`deepseek-v4-pro`

### 触发方式

```javascript
Workflow({
  scriptPath: '.claude/workflows/stage1-prd.js',
  args: {
    userRequirement: '用户原始需求描述',
    context: '可选业务背景'
  }
})
```

### 脚本内部流程

```
phase('需求理解')
  → PM Agent (pro) 读取用户需求
  → 产出理解确认清单 (CEP 卡片)
  → [Human Gate] 用户确认 ✅/⚠️
phase('PRD撰写')
  → PM Agent (pro) 产出 PRD 草案（受 PRD_SCHEMA 约束）
  → 主 Agent 审查 9 章节齐全性
  → 标记 PRD.md 为【锁定版】
```

### PRD 必须包含

| 章节 | 内容 |
|------|------|
| 项目背景 | 业务目标、价值主张、范围边界 |
| 术语定义 | 领域术语、缩写、业务概念 |
| 风险与约束 | 技术约束、业务约束、合规要求 |
| 业务主流程 | 核心用户旅程、系统交互图 |
| ER 关系 | 实体关系图、核心领域模型 |
| 功能需求 | 功能描述、验收标准、业务规则 |
| 复杂/核心专题 | 复杂业务逻辑的深度分析 |
| 核心实体状态图 | 状态机、状态转换条件 |
| 验收标准 | 集成测试场景（happy path + exception path） |

### 门禁

PRD 评审通过后锁定为 `PRD.md`。锁定的 PRD 是后续所有阶段的唯一基准。

### 主 Agent 动作

1. 触发 `Workflow({ scriptPath: '.claude/workflows/stage1-prd.js', args: { userRequirement, context } })`
2. 等待 Workflow 完成
3. 审查产出卡片，确认 9 个章节齐全
4. 门禁通过 → 标记 PRD.md 为【锁定版】→ 进入 Stage2

---

## Stage 2: 规划阶段 — Workflow(`.claude/workflows/stage2-planning.js`)

**前置条件**：`PRD.md` 已存在并锁定。
**执行方式**：触发 Workflow 脚本（内部串行+并行混合）
**模型分配**：Architect/Grill → pro，其余 flash

### 触发方式

```javascript
Workflow({
  scriptPath: '.claude/workflows/stage2-planning.js',
  args: { prdPath: 'PRD.md' }
})
```

### 脚本内部流程

```
// 串行段 — pipeline 模式
阶段① Architect (pro)
  → 输入: PRD.md
  → MQAP: 理解确认清单 → CEP 卡片 → 产出
  → 产出: spec.md + schema.sql + api-contract.yaml【初版】

阶段② Domain Expert (flash)
  → 输入: PRD.md + 阶段①产出【初版】
  → MQAP: 理解确认清单 → CEP 卡片 → 产出
  → 产出: task.md + modules/<module>.md【初版】

阶段↺ Grill Review (pro) — 循环算法
  → 输入: 阶段① + 阶段②产出
  → 双向校验（需求覆盖 / 模块边界 / 术语一致性 / 验收标准）
  → 循环: 发现不一致 → 修正(flash) → 重新审查
  → 终止: 连续2轮零发现 或 6轮硬上限
  → 通过 → 所有产出物升级为【锁定版】

// barrier: 串行段全部通过后才进入并行段

阶段③a Mock Service (flash) ────┐
阶段③b-1 Unit Tests (flash, ≤2) ─┤ 并行
阶段③b-2 E2E Tests (flash, 串行) ─┤
阶段③c Test Review (flash) ────┘ 等③a+③b全完成
  → 4项检查: 文件存在性 / API路由有效性 / 场景覆盖 / fixture一致性
  → 通过标准: 无 ERROR
```

### 审查维度速查

| 审查项 | 检查方式 | 谁审谁 |
|--------|---------|--------|
| 需求覆盖完整性 | PRD 中的功能需求是否在 spec.md 中都有对应接口/表？ | 审查 ① |
| 模块边界合理性 | module docs 的接口/表分配是否与 schema + api-contract 一致？ | 审查 ② |
| 术语一致性 | PRD / spec / module docs 中同一概念是否使用同一术语？ | 审查双方 |
| 验收标准对齐 | module docs 的验收标准是否完整覆盖 PRD 的验收标准？ | 审查 ② |

### Stage 2 门禁

**全部通过后才能进入 Stage 3：**
- [ ] `spec.md`【锁定版】已产出
- [ ] `schema.sql`【锁定版】已产出
- [ ] `api-contract.yaml`【锁定版】已产出
- [ ] `task.md`【锁定版】已产出
- [ ] 所有 `<module>.md`【锁定版】已产出
- [ ] `mocks/` 已搭建并可运行
- [ ] `integration-tests/modules/` 已产出
- [ ] `integration-tests/scenarios/` 已产出
- [ ] ③c 测试用例静态审查通过（无 ERROR）

### 主 Agent 动作

1. 触发 `Workflow({ scriptPath: '.claude/workflows/stage2-planning.js', args: { prdPath: 'PRD.md' } })`
2. Workflow 脚本内部自动处理串行/并行编排
3. 等待 Workflow 完成
4. 审查产出卡片，逐项核对门禁清单
5. 门禁全部通过 → 进入 Stage3

---

## Stage 3: 执行阶段 — Workflow(`.claude/workflows/stage3-execution.js`)

**前置条件**：Stage 2 门禁全部通过。
**执行方式**：触发 Workflow 脚本（大规模并行 fan-out）
**模型分配**：Code Reviewer → pro，其余 flash

### 触发方式

```javascript
Workflow({
  scriptPath: '.claude/workflows/stage3-execution.js',
  args: { taskPath: 'task.md', modulesDir: 'modules/' }
})
```

### 脚本内部流程

```
// 第0步: Coordinator 先行
Coordinator (flash)
  → 读取 task.md 依赖图
  → 输出: 模块分配方案（轮次表 + 依赖关系）

// 主循环: 按依赖图分批 fan-out
while 存在未完成模块:
  1. 扫描状态 → 候选集 = 依赖已满足 ∩ 未分配
  2. 并行分配候选集:
     parallel(后端模块 → agent(BACKEND_DEV_PROMPT, flash))
  3. 每模块完成后:
     if 需要审查 → agent(CODE_REVIEW_PROMPT, pro)
  4. 标记 DONE → 释放下游 → 下一轮

// 前端并行开发（基于 Mock）
parallel(页面模块 → agent(FRONTEND_DEV_PROMPT, flash))
  前端 Agent 不可自标 DONE（涉及 CSS → VISUAL_PENDING）
```

### 文件状态标记（Agent 间通信协议）

Agent 通过模块目录下的状态文件通信。Workflow 脚本扫描文件系统判断进度。

#### DONE 标记

文件路径：`src/modules/<module>/DONE`

文件内容（YAML 格式）：
```yaml
module: <module_name>
agent: <agent_name>
completed_at: "YYYY-MM-DD HH:MM:SS"
checks:
  l1_unit_test: PASS
  l2_api_test: PASS
  l3_db_test: PASS
  l4_headed_test: PASS
  l5_headless_test: PASS
  coverage: 85.2
  code_review: PASS
  flaky_test: false
  visual_computed_style: PASS
  visual_regression: PASS
  visual_layout_integrity: PASS
  visual_human_review: NOT_REQUIRED
issues: []
```

#### BLOCKED 标记

文件路径：`src/modules/<module>/BLOCKED`

```yaml
module: <module_name>
agent: <agent_name>
blocked_at: "YYYY-MM-DD HH:MM:SS"
blocked_by: <dependency_module_or_issue>
reason: |
  [多行描述阻塞原因]
action_required: <what_needs_to_happen>
suggested_fix: <optional_suggestion>
```

#### VISUAL_PENDING 标记

> **前端专用**：当修改涉及 CSS/布局/动画，Agent 不能自行判定视觉正确。

文件路径：`src/modules/<module>/VISUAL_PENDING`

```yaml
module: <module_name>
status: VISUAL_PENDING
reason: CSS layout changed — cannot verify visual correctness autonomously
review_url: "http://localhost:5173/dashboard"
human_action: "请打开 review_url 查看视觉效果，确认无误后删除此文件并创建 DONE"
```

#### 状态扫描规则

| 模块目录状态 | 含义 | Workflow 动作 |
|------------|------|-------------|
| 目录不存在 | 未分配 | 下一轮扫描时分配 |
| 目录存在，无状态文件 | 已分配，开发中 | 等待 |
| DONE 存在 | 已完成 | 释放下游依赖模块 |
| BLOCKED 存在 | 开发阻塞 | 读取原因，决定降级或等待 |
| DEFER 存在 | 主动推迟 | 级联DEFER下游依赖模块 |
| VISUAL_PENDING 存在 | 前端视觉待人类确认 | **不作为DONE**，通知人类审核 |
| DONE 和 BLOCKED 同时存在 | 已完成但有遗留问题 | 标记为 DONE（遗留问题进 Stage4） |
| DONE 和 VISUAL_PENDING 同时存在 | 非法状态 | ERROR：Agent 违规自标 DONE |

### Stage 3 门禁 (MUST — v2.5 视觉强化)

每个模块必须通过完整的5层测试 + 3道视觉防线才能标记DONE：

- [ ] 后端全部模块 DONE（模块目录下存在 DONE 标记）
- [ ] 前端全部页面 DONE（或 VISUAL_PENDING 已由人类确认后转 DONE）
- [ ] **L1 单元测试**：所有Service函数、纯函数、工具函数测试通过
- [ ] **L2 API集成测试**：每个路由的happy+error path测试通过
- [ ] **L3 数据库集成测试**：事务、迁移、约束测试通过
- [ ] **L4 有头浏览器测试**：真实浏览器渲染、交互测试通过
- [ ] **L5 无头CI测试**：Playwright headless测试通过
- [ ] **V1 视觉样式断言**：computed style 断言全部通过
- [ ] **V2 视觉回归快照**：像素对比通过
- [ ] **V3 布局完整性**：无元素重叠、DOM结构正确
- [ ] **覆盖率 ≥ 80%**（statements + branches + functions）
- [ ] **无 flaky tests**：同一测试运行10次全部通过
- [ ] Code Review 无 P0 问题
- [ ] **前端无未解决的 VISUAL_PENDING**
- [ ] **契约合规检查（v2.8）**：前端 API 调用签名与后端 API 契约一致（字段名、枚举值、响应格式 shape、HTTP 状态码）
- [ ] **E2E 覆盖率自动化门禁（v2.9）**：`node scripts/check-e2e-coverage.js --ci` 通过（总用例 ≥70 + 分类最低数）
- [ ] **有头/无头一致性自动化门禁（v2.9）**：`node scripts/check-e2e-parity.js --ci` 通过（L4 与 L5 无 HIGH 差异）

### 测试执行流程

```bash
# 每个模块开发完成后必须执行：
npx vitest run --coverage
npx playwright test tests/visual/<page>.visual.spec.ts
npx playwright test tests/visual/<page>.screenshot.spec.ts
npx playwright test tests/visual/<page>.visual.spec.ts -g "overlapping"

# L4 有头 + L5 无头（分别输出 JSON 结果供 parity 对比）
npx playwright test --project=chromium-headed --reporter=json > test-results/l4-headed.json
npx playwright test --project=chromium-headless --reporter=json > test-results/l5-headless.json

# 强制门禁：覆盖率 + 有头/无头一致性
node scripts/check-e2e-coverage.js --ci
node scripts/check-e2e-parity.js --headed test-results/l4-headed.json --headless test-results/l5-headless.json --ci

npx vitest run --coverage --reporter=json
for i in {1..3}; do npx vitest run; done
```

### 主 Agent 动作

1. 触发 `Workflow({ scriptPath: '.claude/workflows/stage3-execution.js', args: { taskPath, modulesDir } })`
2. Workflow 脚本内部：
   - Coordinator 运行 → 输出分配方案
   - 按依赖图并行 fan-out 后端+前端子任务
   - 扫描 DONE/BLOCKED/VISUAL_PENDING 标记
   - 按需触发 Code Review
3. Workflow 完成后，主 Agent 审查门禁清单
4. 特别检查：无未解决的 VISUAL_PENDING（人类确认所有前端页面）
5. 门禁全部通过 → 进入 Stage4

---

## Stage 4: 集成与验收 — Workflow(`.claude/workflows/stage4-integration.js`)

**前置条件**：Stage 3 门禁全部通过。
**执行方式**：触发 Workflow 脚本（串行收敛）
**模型分配**：Stage4 Coordinator → pro，其余 flash

### 触发方式

```javascript
Workflow({
  scriptPath: '.claude/workflows/stage4-integration.js',
  args: { srcDir: 'src/', mockDir: 'mocks/' }
})
```

### 脚本内部流程

```
阶段4.1 后端合并 (flash)
  → 合并各模块路由到统一入口（app.ts/main.ts）
  → 验证全局 Schema 一致性
  → 运行全量单元测试
  → 输出合并报告

阶段4.2 前后端联调 (flash)
  → 前端切换 Mock → 真实后端 API
  → 按模块逐个联调
  → 记录接口不匹配到 integration-issues.md
  → 问题分类: 契约问题 / 实现问题 / 理解偏差 / Mock偏差

阶段4.3 集成测试 (flash)
  → 运行 integration-tests/modules/ + scenarios/
  → 运行 L1-L5 全部测试层 + V1-V3 视觉检查
  → 输出测试报告 + 覆盖率报告

阶段4.4 Bug修复循环 (flash dev + pro reviewer)
  → while 存在未修复 Bug && 轮次 < 3:
      → agent(分析 Bug 列表, pro)
      → agent(修复 Bug, flash)
      → 回归测试验证
  → 3 轮后仍有 Bug → 标记 BLOCKED

→ 质量审计输出
→ 交付归档 delivery/
```

### 联调问题分类

| 分类 | 判定 | 修复方向 |
|------|------|---------|
| 契约问题 | 接口响应与 api-contract.yaml 不一致 | 修正后端 |
| 实现问题 | 接口符合契约但数据/逻辑错误 | 修正后端 |
| 理解偏差 | 前端对接口理解与后端设计不一致 | 修正前端 + Mock |
| Mock偏差 | Mock 与真实 API 不一致 | 修正 Mock |
| 契约漂移 | 前后端独立生成代码导致字段名/枚举值/响应格式不一致 | 同步修正双方，追溯 api-contract.yaml 是否完整 |

### Stage 4 门禁（终检）(MUST — v2.5 视觉强化 + v2.6 E2E强化)

- [ ] 后端合并完成，路由一致性验证通过
- [ ] 前后端联调全部模块通过
- [ ] 集成测试通过率 100%
- [ ] **5层测试全部通过**：L1-L5无失败
- [ ] **3道视觉防线全部通过**：V1-V3无失败
- [ ] **有头/无头一致性**：L4和L5结果一致
- [ ] **视觉一致性**：所有 VISUAL_PENDING 已由人类确认并转为 DONE
- [ ] **安全测试通过**：防刷、注入、XSS、越权全部通过
- [ ] **性能测试通过**：p99 < 500ms，错误率 < 1%
- [ ] **数据一致性验证**：无外键违反、无orphan记录
- [ ] **Mock-后端一致性**：7个维度全部匹配
- [ ] 无 P0/P1 Bug 遗留
- [ ] **E2E覆盖率自动化通过（v2.9 强制）**：`node scripts/check-e2e-coverage.js --ci` 退出码 0
  - 总用例数 ≥ 70（全量模式）
  - 登录流程 ≥ 12（每角色+错误路径+改密+找回密码+退出）
  - 菜单导航 ≥ 5（完整性+权限+跳转+404+面包屑）
  - 每模块 CRUD ≥ 7（创建成功/失败+列表+详情+编辑+删除+取消删除）
  - 工作流测试 ≥ 21（管理员8+销售7+渠道6）
  - 数据隔离 ≥ 1
- [ ] **有头/无头一致性自动化通过（v2.9 强制）**：`node scripts/check-e2e-parity.js --ci` 退出码 0
  - L4 与 L5 结果一致，无 HIGH 级别差异
  - 类型1（无头独败）/ 类型2（有头独败）/ 类型3（双方失败）全部清零
- [ ] **账号自修复验证**：ensureAccountReady 函数正常工作
- [ ] **全流程深度测试**：每个角色核心业务闭环通过

### 质量审计清单

```markdown
# MVP质量审计报告

## 测试覆盖审计
- [ ] L1-L5 全部测试层
- [ ] V1-V3 视觉防线
- [ ] 状态机测试 / 数据权限测试 / 并发测试 / 边界测试
- [ ] 安全测试 / 性能测试 / 错误恢复测试
- [ ] 前端组件测试

## 一致性审计
- [ ] Mock与后端响应格式一致
- [ ] 有头与无头测试结果一致
- [ ] 视觉快照与基线一致
- [ ] 数据库schema与Drizzle定义一致
- [ ] API实现与api-contract.yaml一致
- [ ] 前端调用与后端路由一致

## 稳定性审计
- [ ] 无flaky tests（连续运行10次全部通过）
- [ ] 无视觉回归
- [ ] 无内存泄漏
- [ ] 无race condition
```

### 主 Agent 动作

1. 触发 `Workflow({ scriptPath: '.claude/workflows/stage4-integration.js', args: { srcDir, mockDir } })`
2. Workflow 脚本内部按 4.1→4.2→4.3→4.4 顺序执行
3. 主 Agent 审查最终测试报告 + 质量审计清单
4. 确认无 P0/P1 Bug
5. **MSVP冒烟验证**：独立验证Agent从用户视角验证应用可用性
6. Stage4 门禁全部通过 → 交付

---

### MSVP冒烟验证协议（v2.6 新增）

> **测试通过 ≠ 应用能跑。** 必须由独立验证Agent，从零冷启动，用真实浏览器点击核心流程，截图证据。

#### A类阻塞Bug清单（零容忍）

| 编号 | 判定标准 | 检测方式 | 典型表现 |
|------|---------|---------|----------|
| A1 | 应用无法启动 | `npm run dev` 报错退出 | 端口冲突、依赖缺失、编译错误 |
| A2 | 首页/登录页白屏 | 导航到首页，截图全白或无内容 | JS 报错阻断渲染、路由配置错误 |
| A3 | 核心菜单 404 | 逐一点击所有菜单项 | 路由未注册、路径拼写错误 |
| A4 | 登录流程不可用 | 输入凭证→点击登录→失败 | API 未启动、CORS 错误、Token 存储失败 |
| A5 | 核心 CRUD 不可用 | 创建→查看列表→编辑→删除 任一步失败 | API 返回 500、数据库写入失败 |
| A6 | Console 红色 Error | DevTools Console 中出现 `error` 级别日志 | 未捕获的异常、网络请求失败 |
| A7 | 页面布局错乱 | 按钮重叠、文字溢出、组件未对齐 | CSS 未加载、样式冲突 |
| A8 | 环境变量/配置缺失 | 应用启动但功能异常 | `.env` 文件缺失或值错误 |

> **门禁**：A1-A8 必须全部为零。任何 A 类 Bug → 不通过 → 修复 → 重新 MSVP → 清零才放行。

#### MSVP验证流程

```
Step 1: 冷启动
  ├── 全新 clone 或 git clean -fd
  ├── npm install / pnpm install（从零安装依赖）
  ├── npm run db:push（初始化数据库）
  ├── npm run db:seed（种子数据）
  └── npm run dev（启动开发服务器）

Step 2: 打开浏览器
  ├── 使用 Playwright（有头模式）
  ├── 打开 Chrome DevTools Console（捕获所有 error/warning）
  └── 设置视口为 1920x1080（标准桌面分辨率）

Step 3: 执行冒烟路径
  ├── 导航到首页 → 截图
  ├── 遍历所有菜单项（逐一检查是否可访问、是否 404）
  ├── 执行核心用户旅程
  └── 每个关键步骤 → 截图

Step 4: A 类阻塞 Bug 检查
  ├── Console 是否有 error → P0
  ├── 是否有 404 请求 → P0
  ├── 菜单项是否完整可点击 → P0
  ├── 核心流程是否走通 → P0
  └── 页面布局是否明显异常 → P0

Step 5: 输出验证报告
```

#### MSVP报告模板

```markdown
# MSVP 验证报告

- **验证时间**：<ISO 8601>
- **应用版本**：<git commit hash>
- **环境**：Node vXX, npm vXX, Chrome vXX

## 冷启动结果
- npm install: ✅ 成功 / ❌ 失败
- npm run db:push: ✅ 成功 / ❌ 失败
- npm run db:seed: ✅ 成功 / ❌ 失败
- npm run dev: ✅ 成功（端口 XXXX）/ ❌ 失败

## 菜单完整性检查
| 序号 | 菜单项 | 目标路由 | 点击结果 | 截图 |
|------|--------|---------|---------|------|
| 1 | 首页 | / | ✅ 正常 | [screenshot] |
| 2 | 产品管理 | /products | ✅ 正常 | [screenshot] |
| 3 | 用户管理 | /users | ❌ 404 | [screenshot] |

## 核心用户旅程
| 步骤 | 操作 | 预期结果 | 实际结果 | 截图 |
|------|------|---------|---------|------|
| 1 | 打开登录页 | 显示登录表单 | ✅ | [screenshot] |
| 2 | 输入凭证点击登录 | 跳转到首页 | ✅ | [screenshot] |
| 3 | 点击"产品管理"菜单 | 显示产品列表 | ❌ 页面白屏 | [screenshot] |

## Console 日志
| 级别 | 消息 | 来源 |
|------|------|------|
| 🔴 ERROR | Uncaught TypeError: Cannot read properties of undefined | products.js:42 |
| 🟡 WARNING | [Vue warn]: Failed to resolve component | App.vue |

## A 类 Bug 清单
| 编号 | 类型 | 描述 | 严重程度 |
|------|------|------|----------|
| 1 | A3 | /users 菜单返回 404 | 阻塞 |
| 2 | A2 | /products 页面白屏 | 阻塞 |

## 判定
- A 类 Bug 数量：<N>
- 判定结果：✅ 通过 / ❌ 不通过
- 阻塞项：<如有，列出>
- 修复后需重新执行 MSVP
```

### MSVP验证Agent约束

- **不能是开发Agent**：写代码的Agent不能验证自己的代码
- **只能读产物，不能读代码**：只看PRD、spec、验收标准——不看实现代码
- **只报告事实，不分析根因**：报告“点击X → 页面白屏 → Console显示TypeError”，不分析哪个文件哪一行
- **截图不可省略**：每个检查步骤必须有截图证据

### MSVP触发时机（v2.7 新增）

> **目标**：明确MSVP验证的触发条件，确保在关键节点进行冒烟验证。

#### 触发条件

```javascript
// MSVP触发配置
const MSVP_TRIGGERS = {
  // Stage4集成测试通过后
  afterIntegrationTest: {
    condition: (stage4Results) => {
      return stage4Results.integrationTestPassed && 
             stage4Results.bugCount.p0 === 0 && 
             stage4Results.bugCount.p1 === 0;
    },
    timing: 'STAGE4_POST_INTEGRATION',
    required: true,
    description: '集成测试通过且无P0/P1 Bug后触发MSVP'
  },
  
  // Bug修复循环完成后
  afterBugFix: {
    condition: (bugFixResults) => {
      return bugFixResults.allBugsFixed && 
             bugFixResults.regressionTestPassed;
    },
    timing: 'STAGE4_POST_BUGFIX',
    required: true,
    description: '所有Bug修复且回归测试通过后触发MSVP'
  },
  
  // 手动触发（人类要求）
  manualTrigger: {
    condition: (humanRequest) => {
      return humanRequest.type === 'MSVP_REQUEST';
    },
    timing: 'ON_DEMAND',
    required: false,
    description: '人类手动请求时触发MSVP'
  },
  
  // 定期验证（长期项目）
  periodicVerification: {
    condition: (projectDuration) => {
      return projectDuration > 7 * 24 * 60 * 60 * 1000; // 超过7天
    },
    timing: 'WEEKLY',
    required: false,
    description: '项目超过7天时每周执行一次MSVP'
  }
};
```

#### MSVP执行流程

```
触发条件满足
    ↓
Stage4 Coordinator检查MSVP前提条件
    ├── 集成测试通过
    ├── 无P0/P1 Bug
    └── 所有VISUAL_PENDING已解决
    ↓
spawn MSVP验证Agent（独立实例）
    ├── 不能是开发Agent
    ├── 只能读产物，不能读代码
    └── 配置验证参数
    ↓
MSVP Agent执行验证
    ├── 冷启动验证
    ├── 菜单完整性检查
    ├── 核心用户旅程验证
    ├── A类Bug检查
    └── 截图证据收集
    ↓
生成MSVP报告
    ├── A类Bug数量
    ├── 验证结果
    └── 阻塞项清单
    ↓
门禁决策
    ├── A类Bug = 0 → 通过 → 允许交付
    └── A类Bug > 0 → 不通过 → 修复 → 重新MSVP
```

#### MSVP与Stage4门禁的关系

| 门禁项 | MSVP验证内容 | 通过条件 |
|--------|-------------|----------|
| 冷启动 | npm install/db:push/db:seed/dev | 全部成功 |
| 菜单完整性 | 所有菜单项可访问 | 无404 |
| 核心流程 | 登录/CRUD/工作流 | 全部走通 |
| Console检查 | 无error级别日志 | 0 error |
| 页面布局 | 无明显错乱 | 截图确认 |

---

### E2E覆盖率检查（v2.7 新增）

> **目标**：确保E2E测试覆盖所有关键业务路径，真实用户使用时不遇到阻塞。

#### E2E覆盖率检查清单

```javascript
// E2E覆盖率检查器
const E2E_COVERAGE_CHECKER = {
  // 最低覆盖率标准
  minimums: {
    totalCases: 70,           // 总用例数
    loginFlow: 12,            // 登录流程
    menuNavigation: 5,        // 菜单导航
    crudPerModule: 7,         // 每模块CRUD
    workflowTests: 21,        // 工作流测试（管理员8+销售7+渠道6）
    dataIsolation: 1          // 数据隔离验证
  },
  
  // 检查函数
  async checkCoverage(testResults) {
    const coverage = {
      passed: true,
      details: {},
      issues: []
    };
    
    // 检查总用例数
    const totalCases = testResults.totalTestCases;
    coverage.details.totalCases = totalCases;
    if (totalCases < this.minimums.totalCases) {
      coverage.passed = false;
      coverage.issues.push({
        type: 'TOTAL_COVERAGE',
        actual: totalCases,
        required: this.minimums.totalCases,
        severity: 'ERROR'
      });
    }
    
    // 检查登录流程
    const loginCases = testResults.testCasesByType.login;
    coverage.details.loginCases = loginCases;
    if (loginCases < this.minimums.loginFlow) {
      coverage.passed = false;
      coverage.issues.push({
        type: 'LOGIN_COVERAGE',
        actual: loginCases,
        required: this.minimums.loginFlow,
        severity: 'ERROR'
      });
    }
    
    // 检查菜单导航
    const menuCases = testResults.testCasesByType.menu;
    coverage.details.menuCases = menuCases;
    if (menuCases < this.minimums.menuNavigation) {
      coverage.passed = false;
      coverage.issues.push({
        type: 'MENU_COVERAGE',
        actual: menuCases,
        required: this.minimums.menuNavigation,
        severity: 'ERROR'
      });
    }
    
    // 检查每个模块CRUD
    const modules = testResults.modules;
    for (const module of modules) {
      const crudCases = module.crudTestCases;
      coverage.details[`${module.name}_crud`] = crudCases;
      if (crudCases < this.minimums.crudPerModule) {
        coverage.passed = false;
        coverage.issues.push({
          type: 'MODULE_CRUD_COVERAGE',
          module: module.name,
          actual: crudCases,
          required: this.minimums.crudPerModule,
          severity: 'ERROR'
        });
      }
    }
    
    // 检查工作流测试
    const workflowCases = testResults.testCasesByType.workflow;
    coverage.details.workflowCases = workflowCases;
    if (workflowCases < this.minimums.workflowTests) {
      coverage.passed = false;
      coverage.issues.push({
        type: 'WORKFLOW_COVERAGE',
        actual: workflowCases,
        required: this.minimums.workflowTests,
        severity: 'ERROR'
      });
    }
    
    // 检查数据隔离
    const isolationCases = testResults.testCasesByType.dataIsolation;
    coverage.details.isolationCases = isolationCases;
    if (isolationCases < this.minimums.dataIsolation) {
      coverage.passed = false;
      coverage.issues.push({
        type: 'ISOLATION_COVERAGE',
        actual: isolationCases,
        required: this.minimums.dataIsolation,
        severity: 'ERROR'
      });
    }
    
    return coverage;
  }
};
```

#### E2E覆盖率报告模板

```markdown
# E2E 覆盖率报告

- **检查时间**：<ISO 8601>
- **测试框架**：Playwright
- **总用例数**：<数量>

## 覆盖率概览

| 检查项 | 实际数量 | 最低标准 | 通过状态 |
|--------|----------|----------|----------|
| 总用例数 | <N> | 70+ | ✅/❌ |
| 登录流程 | <N> | 12+ | ✅/❌ |
| 菜单导航 | <N> | 5+ | ✅/❌ |
| 工作流测试 | <N> | 21+ | ✅/❌ |
| 数据隔离 | <N> | 1+ | ✅/❌ |

## 模块CRUD覆盖

| 模块 | CRUD用例数 | 最低标准 | 通过状态 |
|------|------------|----------|----------|
| user | <N> | 7+ | ✅/❌ |
| product | <N> | 7+ | ✅/❌ |
| order | <N> | 7+ | ✅/❌ |

## 工作流覆盖详情

| 角色 | 用例数 | 最低标准 | 通过状态 |
|------|--------|----------|----------|
| 管理员 | <N> | 8+ | ✅/❌ |
| 销售人员 | <N> | 7+ | ✅/❌ |
| 渠道人员 | <N> | 6+ | ✅/❌ |

## 问题清单

| 问题类型 | 描述 | 严重程度 |
|----------|------|----------|
| TOTAL_COVERAGE | 总用例数不足 | ERROR |
| LOGIN_COVERAGE | 登录流程用例不足 | ERROR |

## 判定结果

- **总体结果**：✅ 通过 / ❌ 不通过
- **阻塞项**：<如有，列出>
- **建议**：<改进建议>
```

#### Stage4门禁E2E检查项

```markdown
# Stage4 门禁 E2E 检查清单

## 覆盖率门禁
- [ ] 总用例数 ≥ 70
- [ ] 登录流程 ≥ 12 用例
- [ ] 菜单导航 ≥ 5 用例
- [ ] 每个模块 CRUD ≥ 7 用例
- [ ] 工作流测试 ≥ 21 用例
- [ ] 数据隔离 ≥ 1 用例

## 质量门禁
- [ ] 每个API端点至少1个Happy Path + 1个Error Path
- [ ] 每个角色至少1个权限校验用例
- [ ] 状态机每个状态转换至少1个用例
- [ ] ensureAccountReady 函数正常工作
- [ ] 无flaky tests（连续3次通过）

## 执行门禁
- [ ] 测试数据隔离（beforeAll重置）
- [ ] 失败测试自动截图
- [ ] 测试报告生成
```

---

## Stage 5: 流程复盘与经验沉淀

**前置条件**：Stage 4 门禁全部通过，项目已交付。
**执行方式**：触发 Workflow 或主 Agent 直接执行（轻量）

### 执行步骤

1. 以 `agents/retrospective-agent.md` 为 prompt 创建复盘子任务
2. 输入：`pipeline-execution-log.md` + `pipeline-metrics.json` + Bug 清单 + 审查报告历史
3. 产出：`retrospective.md` + 可选白皮书修订提案
4. 6项必须产出：
   - 流程健康度评分（各 Stage 实际/预期耗时比值）
   - Agent 效率分析（各角色产出质量、返工率）
   - 契约偏差分析（spec.md 与实际实现的差异点）
   - 模式提取（本次迭代验证有效的实践）
   - 反模式记录（本次迭代暴露的流程缺陷）
   - 白皮书修订建议（具体条款 + 修订理由）
5. 异常模式识别（4项检查）：
   - 模块实际耗时 > 预期 2 倍 → 高风险模块类型
   - Agent CR 打回率 > 30% → 需强化该角色 Skill
   - 阶段实际耗时 > 预期 1.5 倍 → 瓶颈阶段
   - Bug 某类占比 > 40% → 系统性缺陷来源

---

## 增量模式：变更分类决策树 + Stage 裁剪规则

> **核心原则（白皮书 §0.2）：只要不是纯Bug修复，任何对需求、功能、实现方案的变更都必须走完整的增量流水线。**

### 变更类型判定

```
变更请求进入
  │
  ├── 纯Bug修复？（代码逻辑错误、不改需求文档，不增删功能）
  │     ├── 是 → 跳过Stage1-3，直接修复代码 → Stage4验证
  │     └── 否 ↓
  │
  └── 非Bug变更（必须走完整增量流水线）：
        ├── Issue/功能缺陷：需求已定义但实现未覆盖/实现偏离需求
        ├── 新功能点：PRD未定义的全新需求、版本迭代增量
        ├── 改善实现：需求不变但改进技术方案/重构/性能优化
        └── 需求调整：文案变更、字段重命名、业务规则微调
              ↓
        必须执行：PRD修订 → Stage2架构重审Workflow → ↺审查 → Mock同步 → 测试更新 → Stage3开发Workflow → Stage4集成Workflow
```

> **判定红线**：如果变更需要修改 PRD 文档中的**任何一个字**（除错别字修正外），即归为非Bug变更，触发完整流水线。

### 阶段裁剪规则（白皮书 §0.3）

| 迭代场景 | Stage1 | Stage2 | Stage3 | Stage4 |
|---------|--------|--------|--------|--------|
| 新增独立模块 | 更新PRD | 仅新模块走Workflow | 仅新模块 | 集成新模块 |
| 非Bug变更 | 更新PRD | 重走Workflow（受影响模块+接口+Mock+测试） | 重新开发变更模块 | 重新集成 |
| 纯Bug修复 | 跳过 | 跳过 | 跳过 | 仅Stage4 Workflow |

---

## 并发模型速查

| 阶段 | 并行度 | Workflow 内部策略 |
|------|--------|-----------------|
| Stage1 | 串行 | 1 个子任务（PM） |
| Stage2 ①→② | 串行 | 架构先 → 业务后 |
| Stage2 ↺ | 串行循环 | grill 审查 → 修正 → 再审（连续2轮零发现或6轮硬上限） |
| Stage2 ③a/③b-1/③b-2 | 并行 | Mock + 两类测试 同时 fan-out |
| Stage2 ③b-1 内部 | 最多 2 | 按模块平分 |
| Stage2 ③c | 串行 | ③a/③b全部完成后方可启动 |
| Stage3 后端 | Dynamic | Workflow 按依赖图 fan-out，无硬上限 |
| Stage3 前端 | Dynamic | 基于 Mock，与后端并行 fan-out |
| Stage4 | 串行 | 合并 → 联调 → 测试 → 修复 |
| Stage5 | 串行 | 1 个复盘子任务 |

---

## Gotchas

- **先判定再执行**：进入流水线前先走「快速通道：简单任务判定」。简单任务用轻量模式（10-30min），不要对简单任务触发 Workflow 脚本。
- **轻量模式无门禁**：简单任务用户确认即通过，不要求 L1-L5 全层测试。
- **Stage 不可跳过（全量/增量）**：门禁是硬约束。不要在 Stage2 还没锁定时就开始 Stage3 的开发，Schema 变更会导致所有模块返工。
- **Schema 锁定后严禁修改**：如果必须变更，先通知所有依赖该表的 Agent，走变更评审后再修改。
- **模块边界不可交叉**：Backend Agent 只写自己模块的 routes/service/schema。跨模块调用通过 API，不直接访问其他模块的数据库或 Service。
- **Mock 与真实 API 必须一致**：两者基于同一 `api-contract.yaml` 生成。联调发现问题时更新契约文件，然后同步修改 Mock 和真实实现。
- **TDD 是强制流程**：先写测试（RED）→ 再写实现（GREEN）→ 最后重构（REFACTOR）。不允许先写实现再补测试。
- **文件驱动通信**：Agent 之间不直接发消息。Coordinator 通过扫描文件系统中的 DONE/BLOCKED 标记了解进度。产出物文件即状态信号。
- **Workflow 脚本自动伸缩并行度**：stage3-execution.js 按依赖图动态 fan-out，无硬上限。无依赖的模块可全部并行。
- **确定性分配**：同输入必须产生相同的模块拆分和分配结果。`task.md` 中模块的枚举顺序作为稳定排序依据。
- **DEFER vs BLOCKED**：DEFER 是主动推迟，BLOCKED 是被动等待。两者互斥。DEFER 会级联标记下游依赖模块。
- **增量模式判定规则**：纯Bug修复（不改需求文档）→ 跳过 Stage1-3，直接 Stage4。非Bug变更 → 必须走完整增量流水线。
- **LLM 无视觉能力 — 不能自标 DONE**：修改了 CSS/布局/动画的前端 Agent 必须标记 VISUAL_PENDING，等待人类视觉确认。
- **VISUAL_PENDING 不可跳过**：Workflow 脚本将 VISUAL_PENDING 视为非完成状态，不释放下游依赖。
- **视觉回归基线必须进 Git**：`tests/visual/*-snapshots/` 目录提交到版本控制。
- **Workflow 脚本消耗更多 token**：动态 Workflow 脚本比手动模式消耗更多 token。轻量任务不要触发脚本。
- **脚本自包含原则**：4 个 `.claude/workflows/*.js` 脚本内嵌了压缩版 prompt，不依赖运行时读取 `agents/*.md`。修改 prompt 时需同步更新脚本和 agents/ 目录。
- **模型分配显式指定**：每个 agent() 调用通过 `model` 参数显式指定（pro/flash），不依赖 settings.json 全局默认。未指定时 fallback 到 `deepseek-v4-flash`。
- **Grill 循环保护**：stage2-planning.js 的 Grill 循环有 6 轮硬上限 + 重复问题检测，防止无限循环。连续2轮零发现即提前退出。
- **E2E 最低用例数（v2.6 强制）**：全量模式下 L5 E2E 用例数不得低于以下标准。低于此数视为测试不充分，Stage 4 门禁不通过。

| 模块类型 | 最低 E2E 用例数 | 说明 |
|---------|:-----------:|------|
| 登录认证 | 12+ | 正常登录(每角色) + 错误密码 + 入口匹配 + 改密(3场景) + 找回密码 + 退出 |
| 角色管理 | 6+ | CRUD + 启用/禁用 + 权限分配 + 非管理员拒绝 |
| 账号管理 | 8+ | CRUD + 启用/禁用 + 重置密码 + 权限查看 + 手机号校验 + 非管理员拒绝 + 禁用后不可登录 |
| 渠道管理 | 10+ | CRUD + 企业/个人类型 + 启用/禁用 + 重置密码 + 重复手机号 + 关联弹窗 + 销售可创建 |
| 客户管理 | 8+ | CRUD + 单/多联系人 + 关联弹窗 + 渠道人员隔离 + 搜索 |
| 商机管理 | 15+ | 创建+审核(通过/驳回/撤销)+跟进+状态流转+调配+编辑退回+汇总+伙伴报备+隔离 |
| 首页仪表盘 | 3+ | KPI卡片 + 图表 + 按角色数据正确 |
| 导航与布局 | 5+ | 菜单权限(每角色) + 页面跳转 + 用户信息显示 |
| **合计最低** | **70+** | 覆盖所有 PRD 验收标准 + 所有角色 + 所有错误路径 |

> 实际用例数按模块复杂度等比放大。如商机管理含状态机+审批流，应 20+。

- **响应格式标准化（v2.8）**：所有列表类端点 MUST 返回 `{ data: { list: [...], total: N } }`。前端 axios 响应拦截器 MUST 自动解包后端的 `{ data: ... }` 包裹层。多Agent各自独立生成代码时，这是最高频的格式不一致来源——后端Agent返回 `{ data: [...] }`，前端Agent期望 `{ data: { list, total } }`，axios又加一层 `response.data`，实际读取路径变为 `res.data.data.list` 而非 `res.data.list`。**防御方案**：在 Stage 4.2 联调时，用自动化脚本逐端点校验响应 shape。
- **枚举值唯一真源（v2.8）**：后端 zod schema 中的 `z.enum([...])` 是唯一真源（Single Source of Truth）。前端 Agent MUST 从 `api-contract.yaml` 或后端 schema 定义中提取枚举值，**严禁自行发明**。典型血案：前端写 `type: 'company'`，后端只接受 `z.enum(['enterprise', 'individual'])`。此类bug在纯API测试中不可见（测试直接拼正确值），唯有真实浏览器操作才会触发 400 校验失败。
- **E2E 必须穿透代理层（v2.8）**：E2E 测试 MUST 通过前端开发服务器的代理层（如 Vite proxy: `5173 → 3000`）访问后端，**严禁直连后端端口**。直连会漏掉三类关键 bug：(1) 代理路由配置错误或遗漏（如 partner 路由只挂载 externalApp）；(2) axios 响应拦截器逻辑（双重包裹/解包失败）；(3) CORS 头缺失。
- **axios/前端请求实例是胶水代码（v2.8）**：前端统一请求实例（含响应拦截器）是前后端集成的关键胶水层，必须视为一等公民纳入测试范围。所有测试（包括L2/L5）MUST 使用与该实例相同的请求配置，不得用裸 `fetch`/`axios` 绕过拦截器。

### E2E 测试编写最佳实践（v2.6）

#### 1. 文件组织
```
tests/e2e/
├── helpers.ts              # 共享辅助函数（账号准备、登录、导航）
├── auth.spec.ts            # 登录认证（每角色 + 错误路径 + 改密）
├── dashboard-navigation.spec.ts  # 首页 + 导航 + 布局
├── roles-accounts.spec.ts  # 角色管理 + 账号管理
├── channels.spec.ts        # 渠道管理
├── customers.spec.ts       # 客户管理
└── opportunities.spec.ts   # 商机管理（最复杂，用例最多）
```

#### 2. 账号准备自修复模式（MUST）
```typescript
// ✅ 正确：account ready 函数必须能处理脏状态
export async function ensureAccountReady(request, phone, entry) {
  // 尝试 1: 直接登录
  let resp = await request.post(`${API}/auth/login`, { data: { phone, password: '123456', entryType: entry } });
  // 尝试 2: 密码被改 → 自动重置
  if (!resp.token) {
    await request.post(`${API}/auth/forgot-password`, { data: { phone } });
    resp = await request.post(...);
  }
  // 尝试 3: 仍失败 → 抛出明确错误
  if (!resp.token) throw new Error(`Login failed for ${phone}`);
  // 处理后 firstLogin
  ...
}
```

#### 3. 测试隔离（MUST）
- 每个 `describe` 块开头 MUST 调用 `beforeAll` 重置所有种子账号
- 测试间不共享可变状态 — 每个 `it` 可独立运行
- 数据创建类测试在 `afterAll` 清理自己创建的数据

#### 4. 选择器优先级
| 优先级 | 选择器 | 示例 |
|:--:|--------|------|
| 1 | `getByText()` | `page.getByText('密码错误')` |
| 2 | `getByRole()` | `page.getByRole('button', { name: '登录' })` |
| 3 | `text=` 伪选择器 | `page.locator('text=渠道总数')` |
| 4 | `[placeholder="..."]` | `page.locator('input[placeholder="请输入手机号"]')` |
| 5 | `.class` / CSS | `page.locator('.glass-card')` — 最后手段 |

#### 5. 错误处理与调试
- 每个测试的断言 MUST 有明确的失败消息
- 关键步骤后 `await page.waitForTimeout(500)` 避免 React 渲染竞态
- 复杂交互（弹窗、模态框、alert）使用 `page.on('dialog', ...)` 监听
- 失败测试自动截图（Playwright `trace: 'on-first-retry'`）

#### 6. 覆盖率检查清单
- [ ] 每个 API 端点至少 1 个 Happy Path + 1 个 Error Path 用例
- [ ] 每个角色至少 1 个权限校验用例
- [ ] 每个表单至少 1 个空字段提交 + 1 个正常提交用例
- [ ] 状态机每个状态转换至少 1 个用例
- [ ] 数据隔离至少 1 个跨角色验证用例
- [ ] **E2E 测试 MUST 通过前端代理层（Vite proxy 5173→3000），严禁直连后端端口（v2.8）**

#### 7. 全流程深度测试（v2.7 强制）

> **页面可打开 ≠ 功能正确。每个角色必须测完整的"创建→提交→验证→列表可见"闭环。**

| 角色 | 必测全流程 | 最少用例 |
|------|-----------|:------:|
| 管理员 | 登录 → 查看统计 → 创建角色 → 创建账号 → 审核商机(通过+驳回+撤销) → 商机调配 → 查看汇总 | 8 |
| 销售人员 | 登录 → 创建渠道 → 创建客户(关联渠道) → 创建商机 → 查看我的商机 → 商机跟进 → 查看汇总 | 7 |
| 渠道人员 | 登录 → 创建客户 → 报备商机 → 查看商机列表 → 查看商机状态 → 验证数据隔离 | 6 |

**工作流测试文件组织：**
```
tests/e2e/
├── workflows-internal.spec.ts  # 内部全流程（管理员+销售）
└── workflows-partner.spec.ts   # 合作伙伴全流程（渠道人员）
```

**工作流测试强制要求：**
- MUST 用 API 直接创建数据（避免前端表单选择器的不稳定性）
- MUST 验证创建的数据出现在对应列表/详情中
- MUST 覆盖每个角色的核心业务闭环
- MUST 验证跨角色数据隔离
- MUST 在 beforeAll 中确保账号就绪（firstLogin 已处理）

---

## 多Agent契约一致性保障机制（v2.8 新增）

> **教训来源**：微点CRM项目 Stage 3/4 中发现 8 个 bug，其中 6 个根因是前后端 Agent 独立生成代码时的契约漂移。以下机制从源头预防此类问题。

### 1. 契约文件是唯一真源

`api-contract.yaml` 是前后端之间的唯一通信契约。以下信息 MUST 在契约文件中明确定义，不得留给 Agent 自行决定：

| 必须定义 | 示例 | 常见漂移 |
|---------|------|------------|
| 枚举值完整列表 | `type: enum[enterprise, individual]` | 前端写 `company`，后端写 `enterprise` |
| 响应格式 shape | `{ data: { list: T[], total: int } }` | 后端返回 `{ data: [...] }`，前端期望 `{ list, total }` |
| 分页参数命名 | `page: int, pageSize: int` | 前端传 `pageNum`，后端读 `page` |
| 错误响应格式 | `{ code: string, message: string }` | 前端读 `error.message`，后端返回 `errMsg` |
| 认证方式 | `Header: Authorization: Bearer <token>` | 前端加 `X-Auth-Token`，后端读 `Authorization` |

### 2. 自动化契约校验脚本

每个模块完成后，Coordinator MUST 运行契约校验脚本。以下是推荐的校验维度：

```javascript
// contract-validator.js — 在 Stage 3 每模块 DONE 前和 Stage 4.2 联调时执行
const CONTRACT_CHECKS = [
  {
    name: '枚举值校验',
    check: async () => {
      // 逐路由检查：前端提交的枚举值 是否 ⊆ 后端 zod schema 定义的枚举值
      // 方法：扫描前端 .vue/.ts 文件中的 select/radio/switch 选项，与 api-contract.yaml 对比
    }
  },
  {
    name: '响应格式校验',
    check: async () => {
      // 逐路由检查：后端实际返回的 JSON shape 是否与 api-contract.yaml 一致
      // 方法：对每个端点发请求，用 JSON Schema validator 对比实际响应和契约定义
    }
  },
  {
    name: '代理层穿透校验',
    check: async () => {
      // 检查每个前端路由对应的 API 调用，是否全部通过 Vite proxy 可达
      // 方法：从 5173 端口发请求，验证无 404/502/ECONNREFUSED
    }
  },
  {
    name: '角色权限矩阵校验',
    check: async () => {
      // 用每个角色登录，检查各路由的 HTTP 状态码是否符合权限设计
      // 方法：遍历角色 × 路由 矩阵，验证 200/403/401 符合预期
    }
  }
];
```

### 3. 前端开发铁律

1. **枚举值从契约文件提取**：前端所有 `<el-select>`、`<el-radio>` 的 `value` 属性 MUST 与 `api-contract.yaml` 中定义的枚举值完全一致。开发前先用脚本从契约文件生成 `enums.ts` 常量文件。
2. **响应格式在拦截器中统一处理**：所有前端 API 调用 MUST 使用同一个封装好的 `request` 实例。响应拦截器的解包逻辑 MUST 在项目初期就确定并在 `api/index.js`（或等效文件）中实现。
3. **API 调用路径与代理配置同步检查**：每新增一个前端页面，MUST 验证其所有 API 调用的 `/api/*` 路径在 Vite proxy 配置中可达。

### 4. 后端开发铁律

1. **zod schema 即文档**：所有路由的输入校验 MUST 使用 zod schema，枚举值用 `z.enum([...])` 明确定义。这是前后端共享的字段格式真源。
2. **响应格式统一封装**：所有端点 MUST 使用统一的响应格式包装函数（如 `success(data)` → `{ data: { list, total } }`），不得各端点自行拼接 JSON。
3. **双端口路由同步**：如果使用多端口架构（如 internalApp/externalApp），新增路由时 MUST 在两个端口上都验证可达性。

### 5. 门禁强化（Stage 3）

每个模块 DONE 前，新增以下强制检查：
- [ ] 契约校验脚本通过（枚举值 / 响应格式 / 代理层穿透 / 角色权限）
- [ ] 前端 `enums.ts`（或等效常量文件）与 `api-contract.yaml` 一致
- [ ] 所有 API 路径在 Vite proxy 中可达
- [ ] 各角色权限矩阵验证通过

---

## 外部工具引用

| 工具 | 用途 | 说明 |
|------|------|------|
| **Hono** | 后端框架 | 轻量、快速、TypeScript 原生 |
| **Drizzle ORM** | 数据库 ORM | 类型安全、Schema 即代码 |
| **SQLite** | 数据库 | 零配置、原型阶段首选 |
| **Vue 3 + Vite** | 前端框架 | 组合式 API、快速 HMR |
| **Vitest** | 测试框架 | 与 Vite 共享配置、高性能 |
| **OpenAPI 3.0** | 接口契约 | 标准化的 API 描述格式 |

以上仅为默认推荐。如用户指定其他技术栈，以用户指定为准。

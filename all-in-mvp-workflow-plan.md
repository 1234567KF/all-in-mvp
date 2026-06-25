# all-in-mvp Dynamic Workflow 落地计划

> 基于 `\.claude\skills\all-in-mvp\SKILL.md` 的 Dynamic Workflow 执行模式，  
> 将 4 个 Stage 从"文档描述的抽象 Workflow"升级为**真正可执行的工作流脚本**。
> 
> 配套 mental model：`manual-driving` 定义 IoC 人机交互方法论，  
> `all-in-mvp` 承载 Dynamic Workflow 自动化编排。

---

## 目录

-   [一、战略对齐](#%E4%B8%80%E6%88%98%E7%95%A5%E5%AF%B9%E9%BD%90)
-   [二、目录与文件结构](#%E4%BA%8C%E7%9B%AE%E5%BD%95%E4%B8%8E%E6%96%87%E4%BB%B6%E7%BB%93%E6%9E%84)
-   [三、模型分配策略](#%E4%B8%89%E6%A8%A1%E5%9E%8B%E5%88%86%E9%85%8D%E7%AD%96%E7%95%A5)
-   [四、Stage1 — 需求对齐（stage1-prd.js）](#%E5%9B%9Bstage1--%E9%9C%80%E6%B1%82%E5%AF%B9%E9%BD%90stage1-prdjs)
-   [五、Stage2 — 规划校验（stage2-planning.js）](#%E4%BA%94stage2--%E8%A7%84%E5%88%92%E6%A0%A1%E9%AA%8Cstage2-planningjs)
-   [六、Stage3 — 并行开发（stage3-execution.js）](#%E5%85%ADstage3--%E5%B9%B6%E8%A1%8C%E5%BC%80%E5%8F%91stage3-executionjs)
-   [七、Stage4 — 集成验收（stage4-integration.js）](#%E4%B8%83stage4--%E9%9B%86%E6%88%90%E9%AA%8C%E6%94%B6stage4-integrationjs)
-   [八、Grill 循环算法（Stage2 核心）](#%E5%85%ABgrill-%E5%BE%AA%E7%8E%AF%E7%AE%97%E6%B3%95stage2-%E6%A0%B8%E5%BF%83)
-   [九、Stage3 依赖图调度算法](#%E4%B9%9Dstage3-%E4%BE%9D%E8%B5%96%E5%9B%BE%E8%B0%83%E5%BA%A6%E7%AE%97%E6%B3%95)
-   [十、SKILL.md 改动清单](#%E5%8D%81skillmd-%E6%94%B9%E5%8A%A8%E6%B8%85%E5%8D%95)
-   [十一、风险与应对](#%E5%8D%81%E4%B8%80%E9%A3%8E%E9%99%A9%E4%B8%8E%E5%BA%94%E5%AF%B9)
-   [十二、实施路线图](#%E5%8D%81%E4%BA%8C%E5%AE%9E%E6%96%BD%E8%B7%AF%E7%BA%BF%E5%9B%BE)
-   [十三、决策日志](#%E5%8D%81%E4%B8%89%E5%86%B3%E7%AD%96%E6%97%A5%E5%BF%97)

---

## 一、战略对齐

### 角色分工

| Skill | 职责 | 与 Workflow 的关系 |
| --- | --- | --- |
| **all-in-mvp** | 定义 Pipeline 结构、Stage 流程、Agent 角色、技术门禁 | Workflow 脚本按此结构编排子任务 |
| **manual-driving** | 定义 IoC 人机交互协议（MQAP/CEP/RRR/认知同步） | 不涉及 Workflow 编排，专注于人机对话层面 |
| **Dynamic Workflow** | 提供 `agent()`/`parallel()`/`pipeline()` 等编排原语 | 4 个 Stage 各对应一个 `.js` 脚本 |

### 主 Agent 角色转变

| 旧模式（当前） | 新模式（目标） |
| --- | --- |
| 主 Agent 逐个角色扮演，切换 context | 主 Agent = 指挥官，触发 Workflow + 审查产出卡片 |
| 子 Agent prompt 靠主 Agent 对话切换 | 子 Agent 在 Workflow 脚本内独立运行 |
| 所有中间状态在主会话上下文累积 | 中间状态在 Workflow 内隔离，主会话始终干净 |
| 中断后只能重来 | Workflow 支持 `resumeFromRunId` 断点续跑 |
| 最大并行度靠主 Agent 手动管理 | Workflow 自动按依赖图 fan-out |

---

## 二、目录与文件结构

text

Copy

```
d:\manual-driving\├── .claude\│   ├── workflows\              ← 4 个可执行 Workflow 脚本│   │   ├── stage1-prd.js│   │   ├── stage2-planning.js│   │   ├── stage3-execution.js│   │   └── stage4-integration.js│   ├── skills\│   │   └── all-in-mvp\│   │       ├── SKILL.md        ← 需要改写│   │       ├── agents\         ← 保持不变（作为 prompt 参考内容）│   │       │   ├── pm-agent.md│   │       │   ├── architect.md│   │       │   ├── domain-expert.md│   │       │   ├── grill-review.md│   │       │   ├── mock-service.md│   │       │   ├── single-module-test.md│   │       │   ├── scenario-test.md│   │       │   ├── test-review.md│   │       │   ├── pipeline-coordinator.md│   │       │   ├── backend-tdd.md│   │       │   ├── frontend-dev.md│   │       │   ├── code-reviewer.md│   │       │   ├── stage4-coordinator.md│   │       │   ├── debug-fixer.md│   │       │   └── retrospective-agent.md│   │       └── references\│   └── settings.json            ← 全局默认模型│└── all-in-mvp-workflow-plan.md  ← 本文档
```

> **Workflow 脚本原则**：自包含。不依赖运行时读取 `agents/*.md` 文件。  
> prompt 内容直接内嵌在脚本中（模板字符串），保证脚本可独立运行。

---

## 三、模型分配策略

### 可用模型池

| 模型 | 特征 | 适用场景 |
| --- | --- | --- |
| `deepseek-v4-pro` | 强推理，深度分析 | 理解/设计/审查/决策 |
| `deepseek-v4-flash` | 快速生成，轻量推理 | 代码实现/测试/结构化任务 |

### 完整分配表

| Agent 角色 | 分配模型 | 理由 | 容错机制 |
| --- | --- | --- | --- |
| **PM Agent** | `deepseek-v4-pro` | 需求理解错误会级联到所有下游 | 无（源头模型必须最强） |
| **Architect** | `deepseek-v4-pro` | Schema/API 设计错误返工成本极高 | Grill 审查可捕获部分问题 |
| **Grill Reviewer** | `deepseek-v4-pro` | 跨维度一致性校验需要强推理 | 无（审查者本身需要最强） |
| **Code Reviewer** | `deepseek-v4-pro` | 发现隐含缺陷和安全漏洞 | 无（审查独立维度） |
| **Stage4 Coordinator** | `deepseek-v4-pro` | 合并冲突判断、Bug 分类决策 | 集成测试可暴露问题 |
| **Domain Expert** | `deepseek-v4-flash` | 模块划分偏结构化 | Grill 审查把关 |
| **Mock Service** | `deepseek-v4-flash` | 按契约生成，确定性高 | Test Review 校验 |
| **Test Writer** | `deepseek-v4-flash` | 测试用例偏模板化 | Test Review 审查 |
| **Test Reviewer** | `deepseek-v4-flash` | 静态检查（存在性/路由匹配） | 集成测试最终验证 |
| **Pipeline Coordinator** | `deepseek-v4-flash` | 读取依赖图 + 拓扑排序 | 三检机制校验 |
| **Backend Dev** | `deepseek-v4-flash` | TDD 护航 + Code Review 兜底 | CR + 测试双重验证 |
| **Frontend Dev** | `deepseek-v4-flash` | 基于锁定 Mock 开发 | MSVP 冒烟验证 |
| **Debug Fixer** | `deepseek-v4-flash` | 修复目标明确 | 回归测试验证 |

> 共计：**6 个 pro**（PM、Architect、Grill、Code Reviewer、Stage4 Coordinator）+ **7 个 flash**。  
> 每个 agent() 调用在脚本内通过 `model` 参数显式指定，不依赖 settings.json 全局默认值。  
> 如果某个 agent 调用未指定 model，fallback 到 settings.json 的 `deepseek-v4-flash`。

---

## 四、Stage1 — 需求对齐（stage1-prd.js）

### Meta

javascript

Copy

```javascript
meta: {  name: "all-in-mvp-stage1",  description: "需求对齐 — PM Agent 产出 PRD.md",  phases: [    { title: "需求理解", detail: "PM Agent 理解确认" },    { title: "PRD撰写", detail: "PM Agent 产出结构化 PRD" },  ]}
```

### 接口设计

| 项目 | 定义 |
| --- | --- |
| **入参** | `args.userRequirement`（用户原始需求）+ `args.context`（可选业务背景） |
| **schema** | `PRD_SCHEMA` — 约束 PM Agent 产出 9 个必需章节 |
| **模型** | `deepseek-v4-pro` |
| **并行度** | 串行，1 个子 Agent |
| **输出文件** | `PRD.md` + `decisions/stage1-prd-decisions.md` |

### 执行流程

text

Copy

```
phase('需求理解')  → Agent 读取用户需求  → Agent 输出理解确认清单（用自己的话复述 + 不清楚的点）  → [Human Gate] 用户确认 ✅/⚠️phase('PRD撰写')  → Agent 输出 PRD 草案（受 PRD_SCHEMA 约束）  → [Human Gate] 主 Agent 审查 9 章节齐全性  → 标记 PRD.md 为【锁定版】  → 进入 Stage2
```

### PRD\_SCHEMA 结构

javascript

Copy

```javascript
const PRD_SCHEMA = {  type: "object",  properties: {    projectBackground:    { type: "string", description: "项目背景、业务目标、价值主张、范围边界" },    glossary:             { type: "string", description: "术语定义、缩写、业务概念" },    risksAndConstraints:  { type: "string", description: "技术约束、业务约束、合规要求" },    mainFlow:             { type: "string", description: "核心用户旅程、系统交互图" },    erRelations:          { type: "string", description: "实体关系图、核心领域模型" },    functionalRequirements: {      type: "array",      items: {        type: "object",        properties: {          id:          { type: "string" },          description: { type: "string" },            acceptanceCriteria: { type: "string" },          businessRules: { type: "string" }        },        required: ["id", "description", "acceptanceCriteria"]      }    },    complexTopics:        { type: "string", description: "复杂业务逻辑的深度分析" },    stateMachine:         { type: "string", description: "核心实体状态图、状态转换条件" },    acceptanceStandards:  { type: "string", description: "集成测试场景（happy path + exception path）" }  },  required: [    "projectBackground", "glossary", "risksAndConstraints",    "mainFlow", "erRelations", "functionalRequirements",    "acceptanceStandards"  ]}
```

> 第 1-3 次迭代可只校验 required 字段，后续逐步收紧。

### PM Agent Prompt 策略

Workflow 脚本内嵌 PM Agent 的核心指令，而非运行时读取 `agents/pm-agent.md`：

javascript

Copy

```javascript
const PM_PROMPT = `你是一个产品经理 Agent...[核心指令：理解确认 → CEP 卡片 → PRD 撰写 → 产出物确认][基于 all-in-mvp 的 agents/pm-agent.md 内容，压缩为关键指令卡片]`
```

> 原则：不全文复制 agents/\*.md。提取核心约束 + MQAP 流程要点，保证 prompt 长度可控。

---

## 五、Stage2 — 规划校验（stage2-planning.js）

### Meta

javascript

Copy

```javascript
meta: {  name: "all-in-mvp-stage2",  description: "规划校验 — 架构 + 业务 + 审查 + Mock + 测试",  phases: [    { title: "架构设计", detail: "Architect → spec/schema/api-contract" },    { title: "业务规划", detail: "Domain Expert → task/modules" },    { title: "交叉审查", detail: "Grill Review ↺ 修正循环" },    { title: "Mock与测试", detail: "Mock + 单元测试 + E2E → Test Review" },  ]}
```

### 接口设计

| 项目 | 定义 |
| --- | --- |
| **入参** | `args.prdPath`（指向已锁定的 [PRD.md](http://PRD.md)） |
| **模型** | Architect/Grill → pro，其余 flash |
| **并行度** | 串行段 pipeline 无 barrier → 并行段 parallel 有 barrier |
| **输出文件** | `spec.md`, `schema.sql`, `api-contract.yaml`, `task.md`, `modules/*.md`, `mocks/`, `integration-tests/*` |

### 执行流程

text

Copy

```
// 串行段 — pipeline 模式，无 barrier阶段① Architect (pro)  → 输入: PRD.md  → MQAP: 理解确认清单 → CEP 卡片 → 产出 → 产出物确认  → 产出: spec.md + schema.sql + api-contract.yaml【初版】阶段② Domain Expert (flash)  → 输入: PRD.md + 阶段①产出【初版】  → MQAP: 理解确认清单 → CEP 卡片 → 产出 → 产出物确认  → 产出: task.md + modules/<module>.md【初版】阶段↺ Grill Review (pro)  → 输入: 阶段① + 阶段②产出  → 双向校验（需求覆盖 / 模块边界 / 术语一致性 / 验收标准）  → 循环: 发现不一致 → 修正(flash) → 重新审查  → 终止条件: 连续2轮零发现 或 达到6轮上限  → 全部通过 → 所有产出物升级为【锁定版】// 安全屏障 — 串行段全部通过后才进入并行段// (barrier: parallel 需要全部上游锁定)阶段③a Mock Service (flash)  ───┐ 并行阶段③b-1 Unit Tests (flash, ≤2) ─┤阶段③b-2 E2E Tests (flash, 串行) ─┤                                 │阶段③c Test Review (flash) ──────┘ 等③a+③b全部完成  → 4项检查: 文件存在性 / API路由有效性 / 场景覆盖完整性 / fixture一致性  → 通过标准: 无 ERROR→ Gate: 主Agent逐项核对付Stage2门禁清单
```

### 串行段 pipeline 模式说明

javascript

Copy

```javascript
// 伪代码 — pipeline 无 barrierconst stage2Results = await pipeline(  [/* 空数组作占位或直接用串行调用 */],  // 阶段①  async () => {    const architect = await agent(ARCHITECT_PROMPT, { model: 'deepseek-v4-pro', label: 'Architect', schema: ARCH_SCHEMA })    return architect  },  // 阶段②（等阶段①完）  async (prevResult) => {    const domainExpert = await agent(DOMAIN_EXPERT_PROMPT, { model: 'deepseek-v4-flash', label: 'Domain Expert', schema: TASK_SCHEMA })    return domainExpert  },  // 阶段↺（等阶段②完）  async (prevResult) => {    // Grill 循环逻辑（详见第八节）  })// barrier: 串行段全部通过if (!stage2SerialPassed) throw new Error('Stage2 串行段未通过')// 并行段const parallelResults = await parallel([  () => agent(MOCK_PROMPT, { model: 'deepseek-v4-flash', label: 'Mock' }),  () => agent(UNIT_TEST_PROMPT, { model: 'deepseek-v4-flash', label: 'Unit Tests' }),  () => agent(E2E_TEST_PROMPT, { model: 'deepseek-v4-flash', label: 'E2E Tests' }),])
```

---

## 六、Stage3 — 并行开发（stage3-execution.js）

### Meta

javascript

Copy

```javascript
meta: {  name: "all-in-mvp-stage3",  description: "并行开发 — Coordinator 调度 + Backend/Frontend fan-out",  phases: [    { title: "调度分配", detail: "Coordinator 读取依赖图 → 分配方案" },    { title: "模块开发", detail: "按依赖图动态 fan-out 后端+前端" },    { title: "代码审查", detail: "事件驱动的 Code Review" },  ]}
```

### 接口设计

| 项目 | 定义 |
| --- | --- |
| **入参** | `args.taskPath`, `args.modulesDir`（指向锁定版 [task.md](http://task.md) 和 modules/） |
| **模型** | Backend/Frontend Dev → flash，Code Reviewer → pro |
| **并行度** | 无硬上限，完全按依赖图动态 fan-out |
| **输出** | `src/modules/<module>/*`, `src/views/*`, DONE/BLOCKED 标记 |

### 执行流程

text

Copy

```
// 第0步: Coordinator 先行Coordinator (flash)  → 读取 task.md 依赖图  → 输出模块分配方案（轮次表 + 依赖关系）// 主循环: 按依赖图分批 fan-outwhile 存在未完成模块:  1. 扫描所有模块状态     ├── DONE → 已释放     ├── BLOCKED → 记录阻塞原因，等待人工     ├── DEFER → 级联下游     └── 未分配 → 检查依赖  2. 候选集 = 依赖已满足 ∩ 未分配     if 候选集为空:       if 无 BLOCKED: 全部完成 → break       else: await 人工介入 → continue  3. 并行分配候选集:     parallel(候选集.map(m =>       () => agent(后端开发{m}, { model: 'flash', label: `backend:${m}` })     ))  4. 每模块完成后:     if 需要审查: agent(Code Review{m}, { model: 'pro' })     if 需要补充测试: agent(补充测试{m}, { model: 'flash' })  5. 标记 DONE → 释放下游依赖 → 下一轮// 前端与后端并行（基于Mock开发）while 存在未完成页面:  类似后端逻辑，独立 fan-out  前端 Agent 不可自标 DONE（VISUAL_PENDING 需人类确认）
```

### 关键调度逻辑

javascript

Copy

```javascript
const modules = loadTaskGraph(taskPath) // 读取依赖图const done = new Set()const blocked = new Set()while (done.size < modules.length) {  // 选出依赖已满足的候选模块  const candidates = modules.filter(m =>    !done.has(m.name) &&    !blocked.has(m.name) &&    m.dependencies.every(d => done.has(d))  )  if (candidates.length === 0) {    if (blocked.size > 0) {      log(`BLOCKED 模块: ${[...blocked].join(', ')}，等待人工介入`)      await agent(`处理阻塞模块: ${[...blocked].join(', ')}`, { model: 'deepseek-v4-pro' })    }    break  }  // 并行分配  const results = await parallel(candidates.map(m => () =>    agent(`开发模块: ${m.name}`, { model: 'deepseek-v4-flash', label: `mod:${m.name}` })  ))  // 处理结果  results.filter(Boolean).forEach((r, i) => {    const mod = candidates[i]    if (r.status === 'done') {      done.add(mod.name)      if (r.needsReview) {        // 异步触发 Code Review      }    } else if (r.status === 'blocked') {      blocked.add(mod.name)    }  })}
```

### 超时保护

| 阈值 | 动作 |
| --- | --- |
| 单个 Agent > 15min | 输出进度警告 |
| 单个 Agent > 30min | 自动标记 BLOCKED 上报 |
| 整体 Stage > 2h（估算） | 提示主 Agent 确认是否继续 |

---

## 七、Stage4 — 集成验收（stage4-integration.js）

### Meta

javascript

Copy

```javascript
meta: {  name: "all-in-mvp-stage4",  description: "集成验收 — 后端合并 + 前后端联调 + 集成测试 + Bug修复",  phases: [    { title: "后端合并", detail: "路由合并 + Schema 一致性验证" },    { title: "前后端联调", detail: "Mock 切换真实 API" },    { title: "集成测试", detail: "全量测试执行" },    { title: "Bug修复", detail: "修复循环 + 回归验证" },  ]}
```

### 接口设计

| 项目 | 定义 |
| --- | --- |
| **入参** | `args.srcDir`, `args.mockDir` |
| **模型** | Stage4 Coordinator → pro，其余 flash |
| **并行度** | 串行（pipeline 模式，4 阶段串行） |
| **输出** | `delivery/` 归档 + 测试报告 + 质量审计报告 |

### 执行流程

text

Copy

```
阶段4.1 后端合并 (flash)  → 合并各模块路由到统一入口（app.ts/main.ts）  → 验证全局 Schema 一致性（跨 module 表定义无冲突）  → 运行全量单元测试  → 输出合并报告阶段4.2 前后端联调 (flash)  → 前端切换 Mock → 真实后端  → 按模块逐个联调  → 记录接口不匹配到 integration-issues.md  → 问题分类: 契约问题 / 实现问题 / 理解偏差 / Mock偏差阶段4.3 集成测试 (flash)  → 运行 integration-tests/modules/ + scenarios/  → 运行 L1-L5 全部测试层 + V1-V3 视觉检查  → 输出测试报告 + 覆盖率报告  → if 测试通过率 < 100%: 进入阶段4.4阶段4.4 Bug修复循环 (flash dev + pro reviewer)  → while 存在未修复 Bug && 轮次 < 3:      → agent(分析 Bug 列表, { model: 'deepseek-v4-pro' })      → agent(修复 Bug, { model: 'deepseek-v4-flash' })      → 回归测试验证      → if 全部通过: break      → else: 下一轮  → if 3 轮后仍有 Bug: 标记 BLOCKED，需人工介入→ Gate: 主Agent 审查测试报告 + 质量审计清单→ 交付 ✅
```

---

## 八、Grill 循环算法（Stage2 核心）

### 算法设计

text

Copy

```
输入: 阶段①产出（spec/schema/api-contract）+ 阶段②产出（task/modules）参数: MAX_ROUNDS = 6, CONSECUTIVE_PASS = 2输出: 全部 LOCKED 或 BLOCKED(human-review)round = 0consecutiveZero = 0issues = []while consecutiveZero < CONSECUTIVE_PASS and round < MAX_ROUNDS:    round += 1        // 审查（用 pro 模型，深度分析）    result = agent(审查指令 + 上游产出, { model: 'deepseek-v4-pro' })    issues = result.issues  // [{ category, severity, description, sourceFile }]        if issues.length == 0:        consecutiveZero += 1  // 连续零发现计数器 +1        log("Round ${round}: 零问题通过 (${consecutiveZero}/${CONSECUTIVE_PASS})")    else:        consecutiveZero = 0   // 有发现 → 重置连续计数器        log("Round ${round}: 发现 ${issues.length} 个问题")                // 修正（用 flash 模型，快速修改）        agent(修正指令 + issues, { model: 'deepseek-v4-flash' })// 退出后判断if consecutiveZero >= CONSECUTIVE_PASS:    allPassed = true    标记所有产出物为【锁定版】else:    // 达到 6 轮上限仍未通过    allPassed = false    标记 BLOCKED(human-review)
```

### 审查维度

| 维度 | 检查内容 | 输入源 |
| --- | --- | --- |
| 需求覆盖完整性 | PRD 的功能需求 → [spec.md](http://spec.md) 都有对应接口/表？ | PRD vs spec |
| 模块边界合理性 | module docs 的接口/表分配 ↔ schema+api-contract 一致？ | module docs vs schema |
| 术语一致性 | PRD/spec/module docs 同一概念是否同一术语？ | 三方对照 |
| 验收标准对齐 | module docs 验收标准 ↔ PRD 验收标准完全覆盖？ | PRD vs module docs |

### 防无限循环保护

| 保护措施 | 触发条件 | 动作 |
| --- | --- | --- |
| 硬轮次上限 | round ≥ 6 | 强制退出，标记 BLOCKED |
| 连续通过阈值 | consecutiveZero ≥ 2 | 提前退出（质量稳定） |
| 同一问题重复出现 | issue description 与之前轮次重复 | 升级为 BLOCKED（修正无效） |
| Token 保护 | 单轮修正 token 超限 | 提示精简问题范围 |

---

## 九、Stage3 依赖图调度算法

### 数据结构

javascript

Copy

```javascript
// task.md 中模块的依赖图moduleGraph = [  { name: "user",        dependencies: [] },  { name: "auth",        dependencies: ["user"] },  { name: "product",     dependencies: ["user"] },  { name: "order",       dependencies: ["user", "product", "auth"] },  { name: "payment",     dependencies: ["order"] },  { name: "notification", dependencies: ["user", "order"] },]// 模块状态moduleState = Map<moduleName, {  status: 'unallocated' | 'in_progress' | 'done' | 'blocked' | 'deferred',  agent: string | null,  startedAt: timestamp | null,  issues: string[]}>
```

### 调度循环

text

Copy

```
// 第1轮候选: [user] → 分配 Backend-1// 第2轮（user 完成后）候选: [auth, product] → 分配 Backend-2, Backend-3// 第3轮（auth+product 完成后）候选: [order] → 分配 Backend-1// 第4轮（order 完成后）候选: [payment, notification] → 分配 Backend-2, Backend-3// DONE
```

### 三检机制（每轮执行后）

| 检查项 | 验证内容 | 失败处理 |
| --- | --- | --- |
| ①全集校验 | done + in\_progress + unallocated == 模块全集 | ERROR |
| ②依赖校验 | in\_progress 模块的依赖是否全部 done | 回退 unallocated |
| ③容量校验 | 本轮分配数 ≤ 可用 slot | 按优先级裁剪（先核心模块） |

### 前端并行策略

前端页面基于 Mock 开发，与后端独立 fan-out：

-   读取 `task.md` 中的前端模块列表
-   每个页面一个 Agent（flash）
-   所有 API 调用指向 Mock 服务
-   **不可自标 DONE**：涉及 CSS/布局 → 必须标记 VISUAL\_PENDING
-   人类确认 VISUAL\_PENDING 后转为 DONE

---

## 十、[SKILL.md](http://SKILL.md) 改动清单

### 改动文件

`d:\manual-driving\.claude\skills\all-in-mvp\SKILL.md`

### 改动内容

| 位置 | 当前内容 | 改为 |
| --- | --- | --- |
| **L32-54** Dynamic Workflow 执行模式 | 描述"主 Agent 说 ‘Create a workflow: Stage1-PRD’"等自然语言指令 | 描述"Workflow({scriptPath: …})"的脚本化调用方式 + 模型分配表 |
| **L56-70** Workflow 与 Agent Prompt 的关系 | 用 ASCII 图展示子任务引用 agents/\*.md | 更新为引用 4 个工作流脚本的结构图 |
| **L72-78** 如何触发 Workflow | “方式一（推荐）：直接说…” | “方式一：Workflow({scriptPath: ‘.claude/workflows/stage1-prd.js’, args: {…}})” |
| **L166-179** Stage1 定义 | `Workflow("Stage1-PRD")` 抽象 | 引用 `stage1-prd.js` + 入参说明 |
| **L208-256** Stage2 定义 | `Workflow("Stage2-Planning")` 抽象 | 引用 `stage2-planning.js` + 入参说明 |
| **L290-325** Stage3 定义 | `Workflow("Stage3-Execution")` 抽象 | 引用 `stage3-execution.js` + 入参说明 |
| **L445-472** Stage4 定义 | `Workflow("Stage4-Integration")` 抽象 | 引用 `stage4-integration.js` + 入参说明 |
| **L2-11** metadata | 无 workflow 引用 | 新增 `workflow-scripts: [".claude/workflows/stage1-prd.js", ...]` |
| **L611-630** Gotchas | 部分描述针对旧模式 | 更新 Workflow 相关的注意事项 |

> 具体改动在实施 Phase 5 时逐行完成。这里只标识范围。

---

## 十一、风险与应对

| 风险 | 概率 | 影响 | 应对 |
| --- | --- | --- | --- |
| **Workflow 脚本 token 消耗巨大** | 高 | 成本翻倍 | 轻量任务走 QuickStep 快捷通道，不触发 Workflow |
| **agent() prompt 内嵌 agents/\*.md 全文太长** | 高 | token 浪费 | 只提取核心指令卡片（压缩率 60-70%） |
| **Stage2 Grill 循环死循环** | 低 | 无限重试 | 6 轮硬上限 + 重复问题检测 |
| **Stage3 依赖图导致串行化（本应并行的模块被串行）** | 中 | 效率下降 | Coordinator 先行分析，输出优化顺序 |
| **Workflow 中断后状态丢失** | 低 | 进度损失 | `resumeFromRunId` 断点续跑 |
| **主 Agent 对 Workflow 产出审查粗略** | 中 | 质量下降 | 强制逐项核对门禁清单，不可跳过 |
| **VISUAL\_PENDING 被忽略** | 中 | 前端问题逃逸 | Workflow 扫描时强制拦截 VISUAL\_PENDING |
| **模型分配不合理（pro 不够聪明 / flash 不够快）** | 中 | 质量或成本问题 | 每个 agent() 的 model 参数是独立变量，可逐项调整 |

---

## 十二、实施路线图

### Phase 1 — Stage1 脚本（1 轮对话）

text

Copy

```
写 stage1-prd.js  ├── 定义 PRD_SCHEMA  ├── 内嵌 PM Agent prompt（压缩版）  ├── 编写执行流程（理解确认 → PRD撰写）  └── 模拟测试验证通路
```

### Phase 2 — Stage2 脚本（2-3 轮对话）

text

Copy

```
写 stage2-planning.js  ├── Architect agent (pro) + prompt  ├── Domain Expert agent (flash) + prompt  ├── Grill 循环算法实现（最复杂）  ├── Mock agent (flash) + prompt  ├── Test Writer agent (flash) + prompt  ├── Test Reviewer agent (flash) + prompt  └── 串行段 pipeline + 并行段 barrier 编排
```

### Phase 3 — Stage3 脚本（2-3 轮对话）

text

Copy

```
写 stage3-execution.js  ├── Coordinator agent (flash) + prompt  ├── 依赖图解析 + 状态扫描  ├── while 循环调度主逻辑  ├── Backend Dev agent (flash) + prompt  ├── Frontend Dev agent (flash) + prompt  ├── Code Reviewer agent (pro) + prompt  ├── DONE/BLOCKED/VISUAL_PENDING 标记处理  └── 超时保护机制
```

### Phase 4 — Stage4 脚本（1-2 轮对话）

text

Copy

```
写 stage4-integration.js  ├── 后端合并 agent (flash) + prompt  ├── 前后端联调 agent (flash) + prompt  ├── 集成测试 agent (flash) + prompt  ├── Bug修复循环 (flash dev + pro reviewer)  └── 质量审计输出
```

### Phase 5 — [SKILL.md](http://SKILL.md) 改写（1 轮对话）

text

Copy

```
改动 SKILL.md  ├── L32-54: 替换 Dynamic Workflow 触发方式描述  ├── L56-78: 更新 Workflow 引用方式  ├── L166-256: Stage1+Stage2 定义替换  ├── L290-472: Stage3+Stage4 定义替换  ├── metadata: 新增 workflow-scripts 字段  └── Gotchas: 更新 Workflow 注意事项
```

### 依赖顺序

text

Copy

```
Phase 1 (Stage1) ──→ Phase 2 (Stage2) ──→ Phase 3 (Stage3) ──→ Phase 4 (Stage4) ──→ Phase 5 (SKILL.md)    独立                依赖 Stage1 模型         依赖 Stage2 产出物        依赖 Stage3 产出物        依赖全部脚本    （最简单）            最复杂）               （大规模）               （收敛）                  （文档）
```

每个 Phase 产出后由用户审查 → 确认通过后再进下一个 Phase。

---

## 十三、决策日志

### D-001: 脚本放置位置

| 项目 | 值 |
| --- | --- |
| **决策** | Workflow 脚本放在 `.claude/workflows/` |
| **理由** | 独立于 skill 目录，可被多个 skill 共用；Claude Code 默认扫描该目录 |
| **替代方案** | `.claude/skills/all-in-mvp/workflows/` → 被否决，不利于跨 skill 复用 |

### D-002: Prompt 内嵌策略

| 项目 | 值 |
| --- | --- |
| **决策** | agents/\*.md 的 prompt 内容内嵌到 Workflow 脚本中（模板字符串） |
| **理由** | 脚本自包含，可独立运行和测试，不依赖文件系统 |
| **代价** | prompt 和 agents/\*.md 需保持同步（通过 Phase 5 统一维护） |

### D-003: Grill 循环终止条件

| 项目 | 值 |
| --- | --- |
| **决策** | "连续 2 轮零发现"退出，最多 6 轮硬上限 |
| **理由** | 一轮零发现可能因采样偏差错过问题；两轮连续零发现置信度大幅提升 |

### D-004: Stage3 并行上限

| 项目 | 值 |
| --- | --- |
| **决策** | 无硬上限，完全按依赖图动态 fan-out |
| **理由** | Workflow 引擎内部有 cap（min(16, cpu-2)），无需脚本层再加限制 |
| **风险** | 极端情况下（20+ 模块）可能 token 消耗过大 → QuickStep 护拦截简单任务 |

### D-005: 模型控制方式

| 项目 | 值 |
| --- | --- |
| **决策** | 每个 agent() 调用通过 `model` 参数显式指定 |
| **理由** | 与 [SKILL.md](http://SKILL.md) 描述解耦、与 settings.json 全局配置解耦，可独立调整 |
| **fallback** | 未指定 model → 继承 settings.json 的 `deepseek-v4-flash` |

### D-006: 实施顺序

| 项目 | 值 |
| --- | --- |
| **决策** | 按 Stage 自然顺序：Stage1 → Stage2 → Stage3 → Stage4 → [SKILL.md](http://SKILL.md) |
| **理由** | 每个 Stage 的产出是下一个 Stage 的输入，按序验证依赖链更清晰 |
| **变体考虑** | Stage1(最简)→Stage4(串行)→Stage2(最复杂)→Stage3(动态) → 被否决，认知负担高 |

---

*本文档是 all-in-mvp Dynamic Workflow 落地计划的完整方案，所有决策已与用户确认锁定。*

*完成后，`all-in-mvp` 从"文档描述级"升级为"可执行 Dynamic Workflow 级"，  
每个 Stage 的编排逻辑由独立脚本承载，主 Agent 角色转变为 pipeline 指挥官。*
---
name: all-in-mvp
description: Load when user wants to build a full-stack MVP prototype using multi-agent parallel development pipeline. Triggers: MVP, 原型开发, 多Agent并行开发, 全栈快速原型, multi-agent pipeline, 从需求到交付, 多Agent流水线, 并行开发, 快速验证产品, 原型系统, 并行工程. NOT for: single API endpoint, bug fixing, code refactoring, deployment, code review alone.
metadata:
  pattern: pipeline+inversion+reviewer+generator
  stage-gates: true
  max-parallel-agents: 3
  based_on: MVP白皮书 v2.5.0
  platform: claude-code
  workflow-ready: true
---

# Parallel MVP Pipeline — Claude Code Dynamic Workflow 版

> 基于《MVP 白皮书 v2.5》的多 Agent 并行工程方法论。3 种运行模式、严格门禁、最大并行度。增量变更强制走完整流水线（§0.2决策树）。
> **Claude Code 特化版**：利用 Dynamic Workflows（`CLAUDE_CODE_WORKFLOWS=1`）实现脚本化编排，主 Agent 只触发 Workflow + 审查结果，中间状态不占上下文。

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

> **核心变化**：主 Agent 不再手动逐个 spawn subagent。每个 Stage 触发一个 Workflow，Workflow 在对话外独立执行，主 Agent 只接收最终产出卡片。

### 主 Agent 角色转变

| 之前（手动 spawn） | 现在（Workflow 驱动） |
|-------------------|---------------------|
| 主 Agent 手动 spawn pm-agent，等待结果 | 主 Agent 说 "Create a workflow: Stage1-PRD" |
| 主 Agent 读取 task.md 依赖图，手动调度后端/前端 | Workflow 脚本自动读依赖图、fan-out 子任务 |
| 主 Agent 上下文随每个 subagent 膨胀 | 编排在对话外，主 Agent 上下文始终干净 |
| 中断后状态丢失 | Workflow 保存进度，断点续跑 |

### Workflow 触发时机

```
用户需求进入 → 主 Agent 判定模式（轻量/全量/增量）
    │
    ├── 轻量模式 → 主 Agent 直接执行 QuickStep1-3（不触发 Workflow）
    │
    └── 全量/增量模式 → 主 Agent 依次触发 Workflow：
          Stage1-Workflow → Stage2-Workflow → Stage3-Workflow → Stage4-Workflow
          每个 Workflow 完成后，主 Agent 审查产出卡片，确认门禁通过，再触发下一个
```

### Workflow 与 Agent Prompt 的关系

**16 个 `agents/*.md` 文件保持不变**——它们是每个子任务的知识 prompt。Workflow 脚本引用它们：

```
Workflow("Stage2-Planning")
  ├── 子任务①: 以 agents/architect.md 为 prompt，输入 PRD.md
  ├── 子任务②: 以 agents/domain-expert.md 为 prompt，输入 ①的产出
  ├── 子任务↺: 以 agents/grill-review.md 为 prompt，输入 ①②的产出（循环最多3轮）
  ├── 子任务③a: 以 agents/mock-service.md 为 prompt（与③b并行）
  ├── 子任务③b-1: 以 agents/single-module-test.md 为 prompt（最多2并行）
  ├── 子任务③b-2: 以 agents/scenario-test.md 为 prompt（串行）
  └── 子任务③c: 以 agents/test-review.md 为 prompt（等③a③b完）
```

### 如何触发 Workflow

**方式一（推荐）**：直接说
> "Create a workflow to run Stage1 of the all-in-mvp pipeline. Use agents/pm-agent.md as the subagent prompt. Input: [用户需求]. Output: PRD.md"

**方式二**：开启 ultracode 模式后直接描述任务
> "Build a [项目描述] using the all-in-mvp pipeline"

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

## Stage 1: 需求对齐 — Workflow("Stage1-PRD")

**前置条件**：用户需求已收集（如果模糊则先执行 Inversion 采集）。
**产出物**：`PRD.md`
**执行方式**：触发 Workflow（串行，单子任务）

### Workflow 定义

```
Workflow("Stage1-PRD")
  子任务: 以 agents/pm-agent.md 为 prompt
  输入: 用户原始需求 + 业务背景
  产出: PRD.md
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

1. 触发 `Workflow("Stage1-PRD")`
2. 等待 Workflow 完成
3. 审查产出卡片，确认 9 个章节齐全
4. 门禁通过 → 标记 PRD.md 为【锁定版】→ 进入 Stage2

---

## Stage 2: 规划阶段 — Workflow("Stage2-Planning")

**前置条件**：`PRD.md` 已存在并锁定。
**执行方式**：触发单次 Workflow（内部串行+并行混合）

### Workflow 定义

```
Workflow("Stage2-Planning")
  ├── ① 架构专家（串行）
  │     以 agents/architect.md 为 prompt
  │     输入: PRD.md
  │     产出: spec.md + schema.sql + api-contract.yaml【初版】
  │
  ├── ② 业务领域专家（串行，等①完成）
  │     以 agents/domain-expert.md 为 prompt
  │     输入: PRD.md + ①的产出【初版】
  │     产出: task.md + modules/<module>.md【初版】
  │
  ├── ↺ 拷问审查循环（串行，等②完成，最多3轮）
  │     以 agents/grill-review.md 为 prompt
  │     对照 PRD.md 双向校验 ①② 的产出
  │     审查维度: 需求覆盖完整性 / 模块边界合理性 / 术语一致性 / 验收标准对齐
  │     每轮发现不一致 → 修正 → 重新审查
  │     全部通过 → 所有产出物升级为【锁定版】
  │
  ├── ③a Mock 服务（与③b并行）
  │     以 agents/mock-service.md 为 prompt
  │     输入: api-contract.yaml【锁定版】+ task.md【锁定版】
  │     产出: mocks/
  │
  ├── ③b-1 单模块测试（最多2并行）
  │     以 agents/single-module-test.md 为 prompt
  │     按模块平分给2个子任务
  │     产出: integration-tests/modules/<module>.test.ts
  │     只写用例，不执行
  │
  ├── ③b-2 业务条线 E2E 测试（串行）
  │     以 agents/scenario-test.md 为 prompt
  │     输入: PRD.md【锁定版】+ task.md【锁定版】
  │     产出: integration-tests/scenarios/<scenario>.test.ts
  │     只写用例，不执行
  │
  └── ③c 测试用例静态审查（串行，等③a③b全部完成）
        以 agents/test-review.md 为 prompt
        产出: 测试用例审查报告
        4项检查: 文件存在性/API路由有效性/场景覆盖完整性/fixture类型一致性
        通过标准: 无 ERROR 级别问题
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

1. 触发 `Workflow("Stage2-Planning")`
2. Workflow 内部自动处理串行/并行编排
3. 等待 Workflow 完成
4. 审查产出卡片，逐项核对门禁清单
5. 门禁全部通过 → 进入 Stage3

---

## Stage 3: 执行阶段 — Workflow("Stage3-Execution")

**前置条件**：Stage 2 门禁全部通过。
**执行方式**：触发单次 Workflow（大规模并行 fan-out）

### Workflow 定义

```
Workflow("Stage3-Execution")
  │
  ├── Coordinator 子任务（串行，先行）
  │     以 agents/pipeline-coordinator.md 为 prompt
  │     读取 task.md 依赖图
  │     输出: 模块分配方案（哪些先做、哪些并行、哪些等依赖）
  │
  ├── 后端子任务组（按依赖图 fan-out，不限并行数）
  │     以 agents/backend-tdd.md 为 prompt
  │     每个模块一个子任务
  │     遵循 Red→Green→Refactor 微循环
  │     产出: src/modules/<module>/（routes + service + schema + types + test）
  │     完成后在模块目录写入 DONE 标记
  │
  ├── 前端子任务组（与后端并行，基于 Mock）
  │     以 agents/frontend-dev.md 为 prompt
  │     每个页面一个子任务
  │     所有 API 调用指向 Mock 服务
  │     产出: src/views/ + src/components/ + src/composables/
  │     完成后写入 DONE 或 VISUAL_PENDING 标记
  │
  ├── Code Review 子任务（按需触发，事件驱动）
  │     以 agents/code-reviewer.md 为 prompt
  │     当后端子任务测试未通过 或 新增代码未覆盖异常路径时触发
  │
  └── 测试补充子任务（事件驱动）
        后端每完成一个新模块，补充该模块的边界测试
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

### 测试执行流程

```bash
# 每个模块开发完成后必须执行：
npx vitest run --coverage
npx playwright test tests/visual/<page>.visual.spec.ts
npx playwright test tests/visual/<page>.screenshot.spec.ts
npx playwright test tests/visual/<page>.visual.spec.ts -g "overlapping"
npx playwright test --project=chromium-headed
npx playwright test --project=chromium-headless
npx vitest run --coverage --reporter=json
for i in {1..3}; do npx vitest run; done
```

### 主 Agent 动作

1. 触发 `Workflow("Stage3-Execution")`
2. Workflow 内部：
   - Coordinator 子任务运行 → 输出分配方案
   - 按依赖图并行 fan-out 后端+前端子任务
   - 扫描 DONE/BLOCKED/VISUAL_PENDING 标记
   - 按需触发 Code Review
3. Workflow 完成后，主 Agent 审查门禁清单
4. 特别检查：无未解决的 VISUAL_PENDING（人类确认所有前端页面）
5. 门禁全部通过 → 进入 Stage4

---

## Stage 4: 集成与验收 — Workflow("Stage4-Integration")

**前置条件**：Stage 3 门禁全部通过。
**执行方式**：触发 Workflow（串行收敛）

### Workflow 定义

```
Workflow("Stage4-Integration")
  │
  ├── 4.1 后端模块合并
  │     以 agents/stage4-coordinator.md 为 prompt（合并阶段）
  │     合并各模块路由到统一入口 → 验证全局 Schema 一致性 → 运行全量单元测试
  │
  ├── 4.2 前后端联调
  │     前端切换 Mock → 真实后端 API
  │     按模块逐个联调
  │     记录接口不匹配问题到 integration-issues.md
  │
  ├── 4.3 集成测试执行
  │     运行 integration-tests/modules/ + integration-tests/scenarios/
  │     输出测试报告
  │
  └── 4.4 Bug 修复循环
        以 agents/debug-fixer.md 为 prompt
        按需触发修复子任务
        回归测试验证
```

### 联调问题分类

| 分类 | 判定 | 修复方向 |
|------|------|---------|
| 契约问题 | 接口响应与 api-contract.yaml 不一致 | 修正后端 |
| 实现问题 | 接口符合契约但数据/逻辑错误 | 修正后端 |
| 理解偏差 | 前端对接口理解与后端设计不一致 | 修正前端 + Mock |
| Mock偏差 | Mock 与真实 API 不一致 | 修正 Mock |

### Stage 4 门禁（终检）(MUST — v2.5 视觉强化)

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

1. 触发 `Workflow("Stage4-Integration")`
2. Workflow 内部按 4.1→4.2→4.3→4.4 顺序执行
3. 主 Agent 审查最终测试报告 + 质量审计清单
4. 确认无 P0/P1 Bug
5. Stage4 门禁全部通过 → 交付

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
| Stage2 ↺ | 串行循环 | grill 审查 → 修正 → 再审（最多3轮） |
| Stage2 ③a/③b-1/③b-2 | 并行 | Mock + 两类测试 同时 fan-out |
| Stage2 ③b-1 内部 | 最多 2 | 按模块平分 |
| Stage2 ③c | 串行 | ③a/③b全部完成后方可启动 |
| Stage3 后端 | Dynamic | Workflow 按依赖图 fan-out，无硬上限 |
| Stage3 前端 | Dynamic | 基于 Mock，与后端并行 fan-out |
| Stage4 | 串行 | 合并 → 联调 → 测试 → 修复 |
| Stage5 | 串行 | 1 个复盘子任务 |

---

## Gotchas

- **先判定再执行**：进入流水线前先走「快速通道：简单任务判定」。简单任务用轻量模式（10-30min），不要对简单任务触发 Workflow。
- **轻量模式无门禁**：简单任务用户确认即通过，不要求 L1-L5 全层测试。
- **Stage 不可跳过（全量/增量）**：门禁是硬约束。不要在 Stage2 还没锁定时就开始 Stage3 的开发，Schema 变更会导致所有模块返工。
- **Schema 锁定后严禁修改**：如果必须变更，先通知所有依赖该表的 Agent，走变更评审后再修改。
- **模块边界不可交叉**：Backend Agent 只写自己模块的 routes/service/schema。跨模块调用通过 API，不直接访问其他模块的数据库或 Service。
- **Mock 与真实 API 必须一致**：两者基于同一 `api-contract.yaml` 生成。联调发现问题时更新契约文件，然后同步修改 Mock 和真实实现。
- **TDD 是强制流程**：先写测试（RED）→ 再写实现（GREEN）→ 最后重构（REFACTOR）。不允许先写实现再补测试。
- **文件驱动通信**：Agent 之间不直接发消息。Coordinator 通过扫描文件系统中的 DONE/BLOCKED 标记了解进度。产出物文件即状态信号。
- **Workflow 自动伸缩并行度**：与手动 spawn 的固定上限不同，Workflow 按依赖图动态 fan-out。无依赖的模块可全部并行。
- **确定性分配**：同输入必须产生相同的模块拆分和分配结果。`task.md` 中模块的枚举顺序作为稳定排序依据。
- **DEFER vs BLOCKED**：DEFER 是主动推迟（不可/不值得本轮完成），BLOCKED 是被动等待（等待依赖/修复）。两者互斥。DEFER 会级联标记下游依赖模块。
- **增量模式判定规则**：纯Bug修复（不改需求文档）→ 跳过 Stage1-3，直接 Stage4。非Bug变更 → 必须走完整增量流水线。判定红线：只要变更需要修改 PRD 文档中任何一个字，即触发完整流水线。
- **LLM 无视觉能力 — 不能自标 DONE**：修改了 CSS/布局/动画的前端 Agent 必须标记 VISUAL_PENDING，等待人类视觉确认。Agent 自行判定"看起来没问题"是 P0 错误。
- **toBeVisible() 不等于视觉正确**：必须用三道视觉防线（V1 computed style + V2 像素对比 + V3 布局完整性）。
- **VISUAL_PENDING 不可跳过**：Workflow 将 VISUAL_PENDING 视为非完成状态，不释放下游依赖。
- **视觉回归基线必须进 Git**：`tests/visual/*-snapshots/` 目录提交到版本控制。
- **Workflow 消耗更多 token**：Dynamic Workflow 是强力工具，但 token 消耗比手动模式大。轻量任务不要触发 Workflow。

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

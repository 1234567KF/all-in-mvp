---
name: all-in-mvp
description: Load when user wants to build a full-stack MVP prototype using multi-agent parallel development pipeline. Triggers: MVP, 原型开发, 多Agent并行开发, 全栈快速原型, multi-agent pipeline, 从需求到交付, 多Agent流水线, 并行开发, 快速验证产品, 原型系统, 并行工程. NOT for: single API endpoint, bug fixing, code refactoring, deployment, code review alone.
metadata:
  pattern: pipeline+inversion+reviewer+generator
  stage-gates: true
  max-parallel-agents: 3
  based_on: MVP白皮书 v2.5.0
---

# Parallel MVP Pipeline — 多 Agent 并行开发流水线

> 基于《MVP 白皮书 v2.5》的多 Agent 并行工程方法论。3 种运行模式、严格门禁、最大并行度。增量变更强制走完整流水线（§0.2决策树）。

---

## 执行概览

```
【轻量模式】简单任务 → QuickStep1-3（单Agent直通，10-30min）
【全量模式】全新项目 → Stage1→Stage2→Stage3→Stage4（6-10 Agent，4-12h）
【增量模式】迭代项目 → 裁剪Stage执行（1-4h）
```

**黄金规则**：全量/增量模式下 Stage 不可跳过。轻量模式走简化通道（3 步替代 4 Stage）。

---

## 快速通道：简单任务判定（进入流水线前执行）

> **在执行完整流水线之前，先判定任务复杂度。简单任务走轻量通道，避免杀鸡用牛刀。**

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
满足 ≥3 项 → 轻量模式（3 步直通车）
不满足     → 全量/增量模式（完整流水线）
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

> 升级时保留已产出代码，补充执行全量 Stage1→Stage2。

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

## Stage 1: 需求对齐（串行，产品经理 Agent）

**前置条件**：用户需求已收集（如果模糊则先执行 Inversion 采集）。
**产出物**：`PRD.md`

### 执行步骤

1. 用 `agents/pm-agent.md` 作为 prompt 创建产品经理 Agent
2. 给 Agent 提供：用户原始需求 + 业务背景
3. Agent 产出 PRD.md，必须包含：
   - 项目背景与目标
   - 术语定义
   - 风险与约束
   - 业务主流程（用户旅程）
   - ER 关系 / 核心领域模型
   - 功能需求（含验收标准）
   - 核心实体状态图
4. **门禁**：PRD 评审通过后锁定为 `PRD.md`。锁定的 PRD 是后续所有阶段的唯一基准。

---

## Stage 2: 规划阶段（①→②→↺→③a∥③b-1∥③b-2→③c）

**前置条件**：`PRD.md` 已存在并锁定。

### 2.1 ① 架构专家（串行）

1. 用 `agents/architect.md` 创建架构 Agent
2. 输入：`PRD.md`
3. 产出：`spec.md`（架构设计）+ `schema.sql`（数据库 Schema）+ `api-contract.yaml`（接口契约）
4. **技术栈绑定**：询问用户偏好的技术栈或使用默认（Hono + Drizzle + SQLite + Vue 3 + Vite）
5. 产出物标记为【初版】

### 2.2 ② 业务领域专家（串行）

1. 用 `agents/domain-expert.md` 创建业务领域 Agent
2. 输入：`PRD.md` + `spec.md` + `schema.sql` + `api-contract.yaml`（均为【初版】）
3. 产出：
   - `task.md` — 任务全景图（所有模块清单 + 依赖关系）
   - `modules/<module>.md` — 每个模块的详细定义（边界、接口、表、验收标准）
4. 产出物标记为【初版】

### 2.3 ↺ 拷问审查循环（grill review）

**在 ① 和 ② 之间运行的双向校验。**

1. 用 `agents/grill-review.md` 创建审查 Agent
2. 审查 Agent 对照 `PRD.md`（基准），检查：
   - 需求覆盖完整性：PRD 的功能需求在 spec.md 中都有对应接口/表？
   - 模块边界合理性：module docs 与 schema + api-contract 一致？
   - 术语一致性：PRD / spec / module docs 中同一概念用同一术语？
   - 验收标准对齐：module docs 的验收标准完整覆盖 PRD 的验收标准？
3. 发现不一致 → 写审查报告 → ①/② 分别修正 → 重新审查
4. **循环上限 3 轮**，仍不一致 → 输出「未决问题清单」→ 由人类决策
5. 全部通过 → 所有产出物升级为【锁定版】

### 2.4 ③a Mock 服务（与 ③b 并行）

1. 用 `agents/mock-service.md` 创建 Mock Agent
2. 输入：`api-contract.yaml`【锁定版】+ `task.md`【锁定版】
3. 产出：`mocks/` 目录下的完整 Mock 服务
   - 支持所有接口 happy path + 主要 exception path
   - 按模块组织目录结构（与 Stage3 后端分配一致）
   - Mock 外部依赖（支付、短信、存储、推送）

### 2.5 ③b-1 单模块 API 集成测试（最多 2 Agent 内部并行）

1. 按模块平分给 2 个测试 Agent（Agent 数量 ≦ 模块数）
2. 用 `agents/single-module-test.md` 创建测试 Agent
3. 输入：对应模块的 `<module>.md`【锁定版】+ `api-contract.yaml`【锁定版】
4. 产出：`integration-tests/modules/<module>.test.ts`
   - 覆盖：接口输入/输出验证、数据库读写正确性、异常路径
   - **此阶段只写用例，不执行**

### 2.6 ③b-2 业务条线 E2E 测试（1 Agent 串行）

1. 用 `agents/scenario-test.md` 创建端到端测试 Agent
2. 输入：`PRD.md`【锁定版】（业务主流程）+ `task.md`【锁定版】（模块依赖）
3. 产出：`integration-tests/scenarios/<scenario>.test.ts`
   - 覆盖完整用户旅程、跨模块协作流程
   - 准备场景级共享测试数据
   - **此阶段只写用例，不执行**

### 2.7 ③c 测试用例静态审查（串行收尾，1 Agent）

1. 用 `agents/test-review.md` 创建审查 Agent
2. 输入：`integration-tests/modules/` + `integration-tests/scenarios/` + `<module>.md` + `PRD.md`
3. 产出：测试用例审查报告
4. 4项检查：文件存在性、API路由有效性、场景覆盖完整性、fixture类型一致性
5. **此阶段只审查用例结构，不执行测试（执行在 Stage4）**
6. 通过标准：无 ERROR 级别问题。WARNING 可记录但通过。

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

---

## Stage 3: 执行阶段（大规模并行）

**前置条件**：Stage 2 门禁全部通过。

### 3.0 Pipeline Coordinator（调度中枢）

1. 用 `agents/pipeline-coordinator.md` 创建 Coordinator Agent
2. Coordinator 读取 `task.md` 中的模块依赖图，按策略分批分配：

**调度算法**（每轮执行）：
```
1. 依赖图筛选 → 找出「依赖已满足 ∩ 未分配」的候选模块
2. 专家匹配 → 按领域优先分配（认证/业务核心/工具配置）
3. 兜底分配 → 剩余模块给任意空闲 Agent
4. 记录分配 → 模块标记为「已分配」，写入分配日志
```

**后端 Agent 并行上限：3 | 前端 Agent 并行上限：3**

### 文件状态标记（Agent 间通信协议）

Agent 通过模块目录下的状态文件通信。Coordinator 扫描文件系统判断进度。

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
issues: []
```

#### BLOCKED 标记

文件路径：`src/modules/<module>/BLOCKED`

文件内容（YAML 格式）：
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

#### Coordinator 扫描规则

| 模块目录状态 | 含义 | Coordinator 动作 |
|------------|------|-----------------|
| 目录不存在 | 未分配 | 下一轮扫描时分配 |
| 目录存在，无 DONE/BLOCKED | 已分配，开发中 | 等待 |
| DONE 存在 | 已完成 | 释放下游依赖模块 |
| BLOCKED 存在 | 开发阻塞 | 读取原因，决定降级或等待 |
| DEFER 存在 | 主动推迟 | 级联DEFER下游依赖模块，其余模块继续执行 |
| DONE 和 BLOCKED 同时存在 | 已完成但有遗留问题 | 标记为 DONE（遗留问题进 Stage4） |

### 3.1 后端团队：TDD 开发

1. Coordinator 分配模块给后端 Agent（最多 3 个并行）
2. 每个后端 Agent 用 `agents/backend-tdd.md` 创建
3. 每个 Agent 遵循 Red→Green→Refactor 微循环
4. 产出：`src/modules/<module>/`（routes + service + schema + types + test）

### 3.2 前端团队：基于 Mock 开发

1. Coordinator 分配页面给前端 Agent（最多 3 个并行）
2. 每个前端 Agent 用 `agents/frontend-dev.md` 创建
3. 所有 API 调用指向 Mock 服务
4. 产出：`src/views/` + `src/components/` + `src/composables/`

### 3.3 测试团队：持续补充边界用例

- 在后端开发过程中持续补充复杂边界用例
- 后端每完成一个新模块，补充该模块的边界测试

### Stage 3 门禁 (MUST — 迭代18强化)

**测试门禁强化**：每个模块必须通过完整的5层测试才能标记DONE。

- [ ] 后端全部模块 DONE（模块目录下存在 DONE 标记）
- [ ] 前端全部页面 DONE
- [ ] **L1 单元测试**：所有Service函数、纯函数、工具函数测试通过
- [ ] **L2 API集成测试**：每个路由的happy+error path测试通过
- [ ] **L3 数据库集成测试**：事务、迁移、约束测试通过
- [ ] **L4 有头浏览器测试**：真实浏览器渲染、交互测试通过（本地验证）
- [ ] **L5 无头CI测试**：Playwright headless测试通过
- [ ] **覆盖率 ≥ 80%**（statements + branches + functions）
- [ ] **无 flaky tests**：同一测试运行10次全部通过
- [ ] Code Review 无 P0 问题

### Stage 3 测试执行流程

```bash
# 每个模块开发完成后必须执行：

# 1. L1-L3 后端测试
npx vitest run --coverage

# 2. L4 有头浏览器测试（本地人工验证）
npx playwright test --project=chromium-headed

# 3. L5 无头CI测试
npx playwright test --project=chromium-headless

# 4. 覆盖率检查（必须 ≥ 80%）
npx vitest run --coverage --reporter=json

# 5. 稳定性检查（运行3次确保无flaky）
for i in {1..3}; do npx vitest run; done
```

---

## Stage 4: 集成与验收（串行收敛）

**前置条件**：Stage 3 门禁全部通过。

### 4.0 Stage4 Coordinator（集成协调者）

1. 用 `agents/stage4-coordinator.md` 创建 Stage4 Coordinator Agent
2. 编排 4.1-4.5 子阶段执行顺序
3. 接收联调问题 → 分类（契约/实现/理解偏差）→ 分发（后端/前端/Mock）
4. 跟踪Bug修复状态，执行最终门禁检查
5. 可复用 Stage3 Pipeline Coordinator 实例（已有全局上下文）

### 4.1 后端模块合并（四步子流程）

- 合并各模块路由到统一入口
- 验证全局 Schema 一致性
- 运行全量单元测试

### 4.2 前后端联调

- 前端切换 Mock → 真实后端 API
- 按模块逐个联调
- 记录接口不匹配问题

**联调问题记录模板**（每个不匹配问题一条记录，写入 `integration-issues.md`）：

```markdown
## 联调问题记录

### #ISSUE-001: [问题简述]

| 字段 | 值 |
|------|-----|
| **发现时间** | YYYY-MM-DD HH:MM |
| **涉及模块** | <module_name> |
| **涉及接口** | `METHOD /api/xxx` |
| **预期行为** | [api-contract.yaml 中的定义] |
| **实际行为** | [联调中观察到的偏差] |
| **偏差类型** | 响应格式不一致 / 状态码不一致 / 字段缺失 / 字段类型不一致 / 路由不存在 |
| **影响范围** | 前端哪些页面/组件受影响 |
| **修复方式** | 修正后端 / 修正契约 / 修正前端 |
| **修复状态** | 待修复 / 已修复 / 已确认无需修复 |
| **修复人** | <agent_name> |
```

### 4.3 集成测试执行

- 运行 `integration-tests/modules/` + `integration-tests/scenarios/`
- 输出测试报告

### 4.4 Bug 修复

用 `agents/debug-fixer.md` 创建 Debug Agent，按需执行修复循环。

### Stage 4 门禁（终检）(MUST — 迭代20强化)

**终检强化**：集成验收必须通过完整的质量审计清单。

- [ ] 后端合并完成，路由一致性验证通过
- [ ] 前后端联调全部模块通过
- [ ] 集成测试通过率 100%
- [ ] **5层测试全部通过**：L1-L5无失败
- [ ] **有头/无头一致性**：L4和L5结果一致
- [ ] **安全测试通过**：防刷、注入、XSS、越权全部通过
- [ ] **性能测试通过**：p99 < 500ms，错误率 < 1%
- [ ] **数据一致性验证**：无外键违反、无orphan记录
- [ ] **Mock-后端一致性**：7个维度全部匹配
- [ ] 无 P0/P1 Bug 遗留

### 质量审计清单（迭代20最终版）

```markdown
# MVP质量审计报告

## 测试覆盖审计
- [ ] L1 单元测试：所有模块的Service/工具函数
- [ ] L2 API集成测试：所有路由的happy+error path
- [ ] L3 数据库集成测试：事务、迁移、约束
- [ ] L4 有头浏览器测试：真实浏览器验证
- [ ] L5 无头CI测试：CI环境验证
- [ ] 状态机测试：所有状态流转（如有状态实体）
- [ ] 数据权限测试：行级+列级权限（如有多角色）
- [ ] 并发测试：共享资源的竞态条件
- [ ] 边界测试：数值/时间/字符串/集合/分页
- [ ] 安全测试：限流/防重放/SQL注入/XSS/越权/CSRF
- [ ] 性能测试：负载/压力/内存泄漏
- [ ] 错误恢复测试：事务回滚/重试/断路器
- [ ] 地理围栏测试：距离/范围/多边形（如有地理位置）
- [ ] 数据一致性测试：外键/唯一/CHECK/触发器
- [ ] 迁移测试：数据完整性/格式转换/回滚
- [ ] 前端组件测试：渲染/交互/状态/生命周期

## 一致性审计
- [ ] Mock与后端响应格式一致
- [ ] 有头与无头测试结果一致
- [ ] 数据库schema与Drizzle定义一致
- [ ] API实现与api-contract.yaml一致
- [ ] 前端调用与后端路由一致

## 稳定性审计
- [ ] 无flaky tests（连续运行10次全部通过）
- [ ] 无内存泄漏（5分钟负载测试通过）
- [ ] 无race condition（并发测试通过）
```

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
        必须执行：PRD修订 → Stage2架构重审 → ↺审查 → Mock同步 → 测试更新 → Stage3开发 → Stage4集成
```

> **判定红线**：如果变更需要修改 PRD 文档中的**任何一个字**（除错别字修正外），即归为非Bug变更，触发完整流水线。

### 阶段裁剪规则（白皮书 §0.3）

| 迭代场景 | Stage1 | Stage2 | Stage3 | Stage4 |
|---------|--------|--------|--------|--------|
| 新增独立模块 | 更新PRD | 仅新模块走①→②→↺→③ | 仅新模块 | 集成新模块 |
| 非Bug变更（需求迭代/新功能/改善实现/Issue修复） | 更新PRD | 重走①→②→↺→③（受影响模块+接口+Mock+测试） | 重新开发变更模块 | 重新集成 |
| 纯Bug修复（逻辑修正，不改需求） | 跳过 | 跳过 | 跳过 | 仅Stage4 |

---

## 并发模型速查

| 阶段 | 并行度 | 说明 |
|------|--------|------|
| Stage1 | 串行 | 1 个 PM Agent |
| Stage2 ① ② | 串行 | 架构先 → 业务后 |
| Stage2 ↺ | 串行循环 | grill 审查 → 修正 → 再审 |
| Stage2 ③a/③b-1/③b-2 | 并行 | Mock + 两类测试 同时启动 |
| Stage2 ③b-1 内部 | 最多 2 | 按模块平分 |
| Stage2 ③c | 串行 | ③a/③b全部完成后方可启动 |
| Stage3 后端 | 最多 3 | Coordinator 按依赖图调度 |
| Stage3 前端 | 最多 3 | 基于 Mock，无需等后端 |
| Stage4 | 串行 | Stage4 Coordinator 编排 → 合并 → 联调 → 测试 → 修复 |
| Stage5 | 串行 | 1 个复盘 Agent |

---

## Gotchas

- **先判定再执行**：进入流水线前先走「快速通道：简单任务判定」。简单任务用轻量模式（10-30min），不要对简单任务上全量四阶段流水线。
- **轻量模式无门禁**：简单任务用户确认即通过，不要求 L1-L5 全层测试。
- **Stage 不可跳过（全量/增量）**：门禁是硬约束。不要在 Stage2 还没锁定时就开始 Stage3 的开发，Schema 变更会导致所有模块返工。
- **Schema 锁定后严禁修改**：如果必须变更，先通知所有依赖该表的 Agent，走变更评审后再修改。
- **模块边界不可交叉**：Backend Agent 只写自己模块的 routes/service/schema。跨模块调用通过 API，不直接访问其他模块的数据库或 Service。
- **Mock 与真实 API 必须一致**：两者基于同一 `api-contract.yaml` 生成。联调发现问题时更新契约文件，然后同步修改 Mock 和真实实现。
- **TDD 是强制流程**：先写测试（RED）→ 再写实现（GREEN）→ 最后重构（REFACTOR）。不允许先写实现再补测试。
- **文件驱动通信**：Agent 之间不直接发消息。Coordinator 通过扫描文件系统中的 DONE/BLOCKED 标记了解进度。产出物文件即状态信号。
- **Agent 数量上限**：后端 3 个、前端 3 个、测试 2 个。超过上限的模块按批次排队，不新增 Agent。
- **确定性分配**：同输入必须产生相同的模块拆分和分配结果。`task.md` 中模块的枚举顺序作为稳定排序依据。
- **DEFER vs BLOCKED**：DEFER 是主动推迟（不可/不值得本轮完成），BLOCKED 是被动等待（等待依赖/修复）。两者互斥——一个模块不能同时为两者。DEFER 会级联标记下游依赖模块。
- **增量模式判定规则**：纯Bug修复（不改需求文档）→ 跳过 Stage1-3，直接 Stage4。非Bug变更（Issue/新功能/改善实现/需求调整）→ 必须走完整 PRD→Stage2→Stage3→Stage4 增量流水线。判定红线：只要变更需要修改 PRD 文档中任何一个字，即触发完整流水线。不确定时默认走非Bug变更流程。

---

## Stage 5: 流程复盘与经验沉淀（串行，1 Agent）

**前置条件**：Stage 4 门禁全部通过，项目已交付。

### 执行步骤

1. 用 `agents/retrospective-agent.md` 创建复盘 Agent
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
